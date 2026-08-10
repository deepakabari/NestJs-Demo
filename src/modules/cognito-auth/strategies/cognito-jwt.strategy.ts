import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { messages } from '../../../constants/messages.constants';
import { CognitoJwtPayload, RequestWithCookies } from '../../../interfaces/auth.interface';
import { UsersService } from '../../users/users.service';
import { CognitoAuthService } from '../cognito-auth.service';

@Injectable()
export class CognitoJwtStrategy extends PassportStrategy(Strategy, 'cognito-jwt') {
  constructor(
    private readonly config_service: ConfigService,
    private readonly users_service: UsersService,
    private readonly cognito_auth_service: CognitoAuthService,
  ) {
    const region = config_service.get<string>('AWS_REGION', 'us-east-1');
    const user_pool_id = config_service.getOrThrow<string>('COGNITO_USER_POOL_ID');
    const jwks_uri = `https://cognito-idp.${region}.amazonaws.com/${user_pool_id}/.well-known/jwks.json`;
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${user_pool_id}`;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: RequestWithCookies) => {
          return req?.cookies?.['access_token'] || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      passReqToCallback: true,
      // Dynamically fetch Cognito's public keys from JWKS endpoint
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: jwks_uri,
      }),
      issuer,
      algorithms: ['RS256'],
    });
  }

  /**
   * Validate the decoded JWT payload.
   * Cognito access tokens have token_use: 'access'.
   */
  async validate(req: RequestWithCookies, payload: CognitoJwtPayload) {
    // Ensure this is an access token (not an id token)
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }

    // Extract the raw token to perform an online check with Cognito
    let access_token = req?.cookies?.['access_token'];

    // Fallback to headers or query if cookie is not present
    if (!access_token) {
      const auth_header = req.headers.authorization;
      const query_token = req.query.token as string;
      access_token = auth_header ? auth_header.replace('Bearer ', '') : query_token;
    }

    if (!access_token) {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }

    /**
     * ONLINE VERIFICATION (Mandatory for Logout to work immediately)
     * JWT tokens are stateless and their signature remains valid until expiration.
     * By calling GetUser via verifyToken, we ask Cognito if this specific token is still active.
     * If the user has logged out (RevokeTokenCommand called), this will throw an exception.
     */
    await this.cognito_auth_service.verifyToken(access_token);

    // 1. Try to find user by Cognito Sub
    const local_user = await this.users_service.findBySub(payload.sub);
    if (!local_user) {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }

    // 2. If sub not found, check if a user with this email already exists (Lazy Sync)
    // if (!local_user) {
    //   const email = cognito_user_info.attributes.email || payload.email || payload.username;
    //   const first_name = cognito_user_info.attributes.given_name || payload.given_name;
    //   const last_name = cognito_user_info.attributes.family_name || payload.family_name;

    //   const existing_user_by_email = await this.users_service.findByEmail(email);

    //   if (existing_user_by_email) {
    //     // Link the existing user to this new Cognito Sub
    //     local_user = await this.users_service.update(existing_user_by_email.id, {
    //       cognito_sub: payload.sub,
    //     });
    //   } else {
    //     // 3. If no user exists at all, create a new one
    //     local_user = await this.users_service.create({
    //       email: email,
    //       first_name: first_name || payload.username,
    //       last_name: last_name || '',
    //       cognito_sub: payload.sub,
    //     });
    //   }
    // }

    return {
      sub: payload.sub,
      email: local_user.email,
      username: payload.username,
      client_id: payload.client_id,
      scope: payload.scope,
      token_use: payload.token_use,
      id: local_user.id,
      first_name: local_user.first_name,
      last_name: local_user.last_name,
    };
  }
}
