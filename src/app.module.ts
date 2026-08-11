import { Module, NestModule } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { CognitoAuthModule } from './modules/cognito-auth/cognito-auth.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './config/typeorm.config';
import { EncryptionModule } from './modules/encryption/encryption.module';
// import { LoggerMiddleware } from './common/middleware/logger.middleware';

import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './modules/cron/cron.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
      },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EncryptionModule,
    TypeOrmModule.forRoot(AppDataSource.options),
    CognitoAuthModule,
    UsersModule,
    CronModule,
  ],
})
export class AppModule implements NestModule {
  configure() {
    // Disabled LoggerMiddleware for load testing
    // if (process.env.NODE_ENV !== 'production') {
    //   consumer.apply(LoggerMiddleware).forRoutes('*');
    // }
  }
}
