import { withAppLayout, inlineStyles } from './email-layout.helper';

export const WelcomeTemplate = {
  customData: {
    name: '',
    loginUrl: '',
  },
  requiredFields: ['name'],
  SubjectPart: 'Welcome to Code Crafters!',
  HtmlPart: withAppLayout(
    `
    <p style="margin: 0 0 16px 0;">Hello {{name}},</p>
    <p style="margin: 0 0 24px 0;">Welcome to <strong>Code Crafters</strong>. We're thrilled to have you on board! Your account has been successfully created and you're now ready to explore all our features.</p>

    <div style="${inlineStyles.details}">
        <div style="${inlineStyles.detailRow}">
          <span style="${inlineStyles.label}">Account Status</span>
          <span style="${inlineStyles.value}">ACTIVE</span>
        </div>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{{loginUrl}}" style="display: inline-block; padding: 14px 32px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; letter-spacing: 0.5px;">
        LOG IN TO YOUR ACCOUNT
      </a>
    </div>

    <p style="color: #64748b; font-size: 14px; margin: 0;">If you didn't create this account, please ignore this email or contact support.</p>
  `,
    {
      title: 'Welcome Aboard',
    }
  ),
};
