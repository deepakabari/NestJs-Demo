import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CognitoAuthModule } from '../cognito-auth/cognito-auth.module';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [ConfigModule, CognitoAuthModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
