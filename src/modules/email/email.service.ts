import { SendEmailCommand, SendEmailResponse, SESv2Client } from '@aws-sdk/client-sesv2';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_TEMPLATE_MAP } from '../../constants/aws.constants';
import {
  EmailTemplateStructure,
  SendEmailParams,
  TemplateVariables,
} from '../../interfaces/aws.interface';
import * as EmailTemplates from '../../email_templates';

const TEMPLATES: Record<string, EmailTemplateStructure> = EmailTemplates;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sesV2: SESv2Client;

  constructor(private readonly configService: ConfigService) {
    this.sesV2 = new SESv2Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResponse> {
    const emailContent =
      params.subject && params.body
        ? this.buildRawContent(params.subject, params.body)
        : this.buildTemplatedContent(params);

    return this.dispatchEmail(emailContent, params);
  }

  private interpolate(template: string, variables: TemplateVariables): string {
    return template.replace(/{{(\w+)}}/g, (match: string, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null) return match;
      return String(value);
    });
  }

  private buildRawContent(subject: string, body: string) {
    return {
      Simple: {
        Subject: { Data: subject },
        Body: { Html: { Data: body } },
      },
    };
  }

  private buildTemplatedContent({ type, customData }: SendEmailParams) {
    if (!type) throw new BadRequestException('"type" or ("subject" and "body") must be provided.');

    const templateName = EMAIL_TEMPLATE_MAP[type];
    const template = TEMPLATES[templateName];

    if (!template) throw new NotFoundException(`Template not found: ${templateName}`);

    const finalCustomData = { ...template.customData, ...(customData ?? {}) };
    this.validateRequiredFields(template.requiredFields, finalCustomData);

    return this.buildRawContent(
      this.interpolate(template.SubjectPart, finalCustomData),
      this.interpolate(template.HtmlPart, finalCustomData),
    );
  }

  private validateRequiredFields(requiredFields: string[], data: Record<string, unknown>): void {
    const missing = requiredFields.filter((field) => {
      const val = data[field];
      return val === undefined || val === null || (typeof val === 'string' && !val.trim());
    });

    if (missing.length) {
      throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  private toAddresses = (val: string | string[]): string[] => (Array.isArray(val) ? val : [val]);

  private async dispatchEmail(
    content: object,
    { sendTo, cc }: SendEmailParams,
  ): Promise<SendEmailResponse> {
    const sourceEmail = this.configService.getOrThrow<string>('AWS_SES_SENDER_EMAIL');
    const replyToEmail = this.configService.get<string>('AWS_SES_REPLY_TO_EMAIL');

    const params = {
      Content: content,
      Destination: {
        ToAddresses: this.toAddresses(sendTo),
        ...(cc && { CcAddresses: this.toAddresses(cc) }),
      },
      FromEmailAddress: sourceEmail,
      ReplyToAddresses: replyToEmail ? [replyToEmail] : [],
    };

    const response = await this.sesV2.send(new SendEmailCommand(params));
    this.logger.log('Email sent successfully');
    return response;
  }
}
