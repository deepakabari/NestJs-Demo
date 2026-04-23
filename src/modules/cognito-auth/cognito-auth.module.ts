import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CognitoJwtStrategy } from './strategies/cognito-jwt.strategy';
import { CognitoAuthController } from './cognito-auth.controller';
import { CognitoAuthService } from './cognito-auth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'cognito-jwt' }), forwardRef(() => UsersModule)],
  controllers: [CognitoAuthController],
  providers: [CognitoAuthService, CognitoJwtStrategy],
  exports: [CognitoAuthService, PassportModule],
})
export class CognitoAuthModule {}
