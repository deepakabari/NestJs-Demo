import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { CognitoAuthModule } from './modules/cognito-auth/cognito-auth.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './config/typeorm.config';
import { EncryptionModule } from './modules/encryption/encryption.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './modules/tasks/tasks.module';
import { EventsModule } from './modules/events/events.module';
import { EmailModule } from './modules/email/email.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EncryptionModule,
    TypeOrmModule.forRoot(AppDataSource.options),
    ScheduleModule.forRoot(),
    CognitoAuthModule,
    UsersModule,
    TasksModule,
    EventsModule,
    EmailModule,
    PaymentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    if (process.env.NODE_ENV !== 'production') {
      consumer.apply(LoggerMiddleware).forRoutes('*');
    }
    
    // Apply CSRF protection globally, but EXCLUDE public auth routes
    consumer
      .apply(CsrfMiddleware)
      .exclude(
        'cognito-auth/signup',
        'cognito-auth/login',
        'cognito-auth/confirm',
        'cognito-auth/forgot-password',
        'cognito-auth/reset-password',
        'cognito-auth/resend-code',
        'cognito-auth/google',
        'cognito-auth/google/callback',
      )
      .forRoutes('*');
  }
}
