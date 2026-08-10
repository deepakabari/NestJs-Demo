export enum EMAIL_TYPE {
  WELCOME = 'WELCOME',
}

export const EMAIL_TEMPLATE_MAP: Record<EMAIL_TYPE, string> = {
  [EMAIL_TYPE.WELCOME]: 'WelcomeTemplate',
};