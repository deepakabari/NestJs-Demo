import { Request } from 'express';

export interface CognitoTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

export interface CognitoJwtPayload {
  sub: string;
  email?: string;
  username: string;
  client_id: string;
  scope?: string;
  token_use: string;
  given_name?: string;
  family_name?: string;
}

export interface RequestWithCookies extends Request {
  cookies: Record<string, string | undefined>;
}

export interface RequestWithCognitoUser extends RequestWithCookies {
  user: {
    id: number;
    sub: string;
    email: string;
    username: string;
    client_id: string;
    scope: string;
    token_use: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  };
}
