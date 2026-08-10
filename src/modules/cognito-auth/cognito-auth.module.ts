import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CognitoJwtStrategy } from './strategies/cognito-jwt.strategy';
import { CognitoAuthController } from './cognito-auth.controller';
import { CognitoAuthService } from './cognito-auth.service';
import { UsersModule } from '../users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { Session } from './entities/session.entity';
import { SessionService } from './session.service';
import { CookieAuthGuard } from '../../common/guards/cookie-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'cognito-jwt' }),
    forwardRef(() => UsersModule),
    EmailModule,
  ],
  controllers: [CognitoAuthController],
  providers: [CognitoAuthService, CognitoJwtStrategy, SessionService, CookieAuthGuard],
  exports: [CognitoAuthService, PassportModule, SessionService],
})
export class CognitoAuthModule {}
