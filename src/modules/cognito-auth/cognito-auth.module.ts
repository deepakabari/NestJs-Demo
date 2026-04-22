import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CognitoAuthService } from './cognito-auth.service';
import { CognitoAuthController } from './cognito-auth.controller';
import { CognitoJwtStrategy } from './strategies/cognito-jwt.strategy';

@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'cognito-jwt' })],
  controllers: [CognitoAuthController],
  providers: [CognitoAuthService, CognitoJwtStrategy],
  exports: [CognitoAuthService, PassportModule],
})
export class CognitoAuthModule {}
