import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithCognitoUser } from '../../interfaces/auth.interface';

/**
 * Custom decorator to extract the user object (or a specific property of it)
 * from the request after it has been populated by the CognitoJwtGuard.
 */
export const GetUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithCognitoUser>();
  const user = request.user;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return data ? user?.[data] : user;
});
