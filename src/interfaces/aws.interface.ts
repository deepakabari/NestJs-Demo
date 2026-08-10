import { EMAIL_TYPE } from '../constants/aws.constants';

export type TemplateVariables = Record<string, string | number | boolean>;

export type SendEmailParams = {
  type?: EMAIL_TYPE;
  sendTo: string | string[];
  cc?: string | string[];
  customData?: TemplateVariables;
  subject?: string;
  body?: string;
};

export interface EmailTemplateStructure {
  customData: TemplateVariables;
  requiredFields: string[];
  SubjectPart: string;
  HtmlPart: string;
}
