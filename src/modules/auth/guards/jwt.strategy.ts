import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config_service: ConfigService,
    private users_service: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config_service.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { user_id: number; email: string }) {
    const user = await this.users_service.findOne(payload.user_id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
