import { Request } from 'express';
import { User } from 'src/modules/users/entities/user.entity';

export interface RequestWithUser extends Request {
  user: User;
}

export interface Auth0JwtPayload {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
  email_verified?: boolean;
  aud: string | string[];
  iss: string;
  iat: number;
  exp: number;
}
