import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from '../../interfaces/auth.interface';
import { User } from '../../modules/users/entities/user.entity';

/**
 * Custom decorator to extract the user object (or a specific property of it)
 * from the request after it has been populated by the JwtAuthGuard.
 */
export const GetUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
