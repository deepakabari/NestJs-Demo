import { FastifyRequest } from 'fastify';

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

export interface RequestWithCognitoUser extends FastifyRequest {
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
