import { ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequestWithCognitoUser, RequestWithCookies } from '../../interfaces/auth.interface';
import { SessionService } from '../../modules/cognito-auth/session.service';

/**
 * Custom guard that validates BOTH the JWT token and the bound fingerprint.
 *
 * It extends the base Passport AuthGuard to perform normal JWT validation,
 * then intercepts the successful validation to additionally check the
 * fingerprint cookie against the database hash.
 */
@Injectable()
export class CookieAuthGuard extends AuthGuard('cognito-jwt') {
  private readonly logger = new Logger(CookieAuthGuard.name);

  constructor(private readonly session_service: SessionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. First let Passport validate the JWT (calls the Strategy)
    const is_jwt_valid = await super.canActivate(context);
    if (!is_jwt_valid) {
      return false;
    }

    // 2. JWT is valid, now validate the fingerprint binding
    const req = context.switchToHttp().getRequest<RequestWithCognitoUser & RequestWithCookies>();

    const cognito_sub = req.user?.sub;
    const raw_fingerprint = req.cookies?.['__fingerprint'];

    if (!cognito_sub) {
      this.logger.error('CookieAuthGuard: Valid JWT missing sub claim');
      throw new UnauthorizedException('Invalid token structure');
    }

    if (!raw_fingerprint) {
      this.logger.warn(`CookieAuthGuard: Missing fingerprint cookie for user ${cognito_sub}`);
      throw new UnauthorizedException('Missing session fingerprint');
    }

    // 3. Verify fingerprint hash against DB
    const is_fingerprint_valid = await this.session_service.validateFingerprint(
      cognito_sub,
      raw_fingerprint,
    );

    if (!is_fingerprint_valid) {
      this.logger.warn(
        `CookieAuthGuard: Fingerprint mismatch for user ${cognito_sub} (possible stolen cookie)`,
      );
      throw new UnauthorizedException('Invalid session fingerprint');
    }

    return true;
  }
}
