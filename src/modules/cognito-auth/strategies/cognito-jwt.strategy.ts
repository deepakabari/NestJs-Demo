import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { messages } from '../../../constants/messages.constants';
import { CognitoJwtPayload } from '../../../interfaces/auth.interface';
import { UsersService } from '../../users/users.service';
import { CognitoAuthService } from '../cognito-auth.service';

@Injectable()
export class CognitoJwtStrategy extends PassportStrategy(Strategy, 'cognito-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly cognitoAuthService: CognitoAuthService,
  ) {
    const region = configService.get<string>('AWS_REGION', 'us-east-1');
    const userPoolId = configService.getOrThrow<string>('COGNITO_USER_POOL_ID');
    const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
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
  async validate(req: Request, payload: CognitoJwtPayload) {
    // Ensure this is an access token (not an id token)
    if (payload.token_use !== 'access') {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }

    // 1. Try to find user by Cognito Sub
    let localUser = await this.usersService.findBySub(payload.sub);

    // 2. If sub not found, check if a user with this email already exists
    if (!localUser) {
      let email = payload.email;
      let firstName = payload.given_name;
      let lastName = payload.family_name;

      // If attributes are missing from Access Token, fetch them from Cognito UserInfo API
      if (!email) {
        try {
          const authHeader = req.headers.authorization;
          const accessToken = authHeader?.replace('Bearer ', '');
          if (!accessToken) {
            throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
          }
          const cognitoUserInfo = await this.cognitoAuthService.verifyToken(accessToken);

          email = cognitoUserInfo.attributes.email;
          firstName = cognitoUserInfo.attributes.given_name;
          lastName = cognitoUserInfo.attributes.family_name;
        } catch {
          email = payload.username; // Fallback
        }
      }

      const existingUserByEmail = await this.usersService.findByEmail(email);

      if (existingUserByEmail) {
        // Link the existing user to this new Cognito Sub
        localUser = await this.usersService.update(existingUserByEmail.id, {
          cognitoSub: payload.sub,
        });
      } else {
        // 3. If no user exists at all, create a new one (Lazy Sync)
        localUser = await this.usersService.create({
          email: email,
          firstName: firstName || payload.username,
          lastName: lastName || '',
          cognitoSub: payload.sub,
        });
      }
    }

    return {
      sub: payload.sub,
      email: localUser.email,
      username: payload.username,
      clientId: payload.client_id,
      scope: payload.scope,
      tokenUse: payload.token_use,
      id: localUser.id,
      firstName: localUser.firstName,
      lastName: localUser.lastName,
    };
  }
}
