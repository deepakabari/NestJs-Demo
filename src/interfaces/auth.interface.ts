import { FastifyRequest } from 'fastify';
import { User } from '../modules/users/entities/user.entity';

export interface JwtPayload {
  user_id: number;
  email: string;
}

export interface RequestWithUser extends FastifyRequest {
  user: User;
}
