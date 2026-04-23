import { Request } from 'express';

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

export interface RequestWithCognitoUser extends Request {
  user: {
    id: number;
    sub: string;
    email: string;
    username: string;
    clientId: string;
    scope: string;
    tokenUse: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
  };
}
