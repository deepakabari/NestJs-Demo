import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { messages } from 'src/constants/messages.constants';

@Injectable()
export class CognitoJwtStrategy extends PassportStrategy(Strategy, 'cognito-jwt') {
  constructor(private readonly configService: ConfigService) {
    const region = configService.get<string>('AWS_REGION', 'us-east-1');
    const userPoolId = configService.getOrThrow<string>('COGNITO_USER_POOL_ID');
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Dynamically fetch Cognito's public keys from JWKS endpoint
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
      issuer,
      algorithms: ['RS256'],
    });
  }

  /**
   * Validate the decoded JWT payload.
   * Cognito access tokens have token_use: 'access'.
   */
  validate(payload: any) {
    // Ensure this is an access token (not an id token)
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }

    return {
      sub: payload.sub,
      email: payload.email || payload.username,
      username: payload.username,
      clientId: payload.client_id,
      scope: payload.scope,
      tokenUse: payload.token_use,
    };
  }
}
