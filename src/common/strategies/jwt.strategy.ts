import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/modules/users/entities/user.entity';
import { Auth0JwtPayload } from '../../interfaces/auth.interface';
import { messages } from 'src/constants/messages.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {
    const auth0Domain = configService.get<string>('AUTH0_DOMAIN');
    const auth0Audience = configService.get<string>('AUTH0_AUDIENCE');

    if (!auth0Domain) {
      throw new InternalServerErrorException(messages.AUTH0_DOMAIN_NOT_FOUND);
    }
    if (!auth0Audience) {
      throw new InternalServerErrorException(messages.AUTH0_AUDIENCE_NOT_FOUND);
    }

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: auth0Audience,
      issuer: `https://${auth0Domain}/`,
      algorithms: ['RS256'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: Auth0JwtPayload): Promise<User> {
    const auth0Id = payload.sub;

    let user = await this.usersRepository.findOneBy({ auth0Id });

    // If user already exists and has an email, no need to fetch /userinfo
    if (user && user.email) {
      user.lastLogin = new Date();
      await this.usersRepository.save(user);
      return user;
    }

    let email = payload.email ?? null;
    let name = payload.name;
    if (name === email && payload.nickname) {
      name = payload.nickname;
    }
    name = name ?? payload.nickname ?? 'User';
    let emailVerified = payload.email_verified ?? false;

    // If email is not in payload, fetch it from Auth0 /userinfo endpoint
    if (!email) {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          const domain = this.configService.get<string>('AUTH0_DOMAIN');
          const userInfoRes = await fetch(`https://${domain}/userinfo`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (userInfoRes.ok) {
            const userInfo = (await userInfoRes.json()) as {
              email?: string;
              name?: string;
              nickname?: string;
              email_verified?: boolean;
            };
            email = userInfo.email ?? email;

            let fetchedName = userInfo.name;
            if (fetchedName === userInfo.email && userInfo.nickname) {
              fetchedName = userInfo.nickname;
            }
            name = fetchedName ?? userInfo.nickname ?? name;

            emailVerified = userInfo.email_verified ?? emailVerified;
          }
        } catch (err) {
          console.error('Failed to fetch userinfo from Auth0', err);
        }
      }
    }

    // Check if user exists with the same email but a different auth0Id (Social Account Linking fallback)
    if (!user && email) {
      user = await this.usersRepository.findOneBy({ email });
      if (user) {
        user.auth0Id = auth0Id;
      }
    }

    if (user) {
      // Update existing user that had missing email or changed auth0Id
      user.email = email;
      user.name = name;
      user.emailVerified = emailVerified;
      user.lastLogin = new Date();
      await this.usersRepository.save(user);
    } else {
      // Create new user
      user = this.usersRepository.create({
        auth0Id,
        email,
        name,
        emailVerified,
        lastLogin: new Date(),
      });
      await this.usersRepository.save(user);
    }

    return user;
  }
}
