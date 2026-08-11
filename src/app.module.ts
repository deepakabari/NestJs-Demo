import { Module, NestModule } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './config/typeorm.config';
// import { LoggerMiddleware } from './common/middleware/logger.middleware';

import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './modules/cron/cron.module';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './modules/auth/auth.module';

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
    TypeOrmModule.forRoot(AppDataSource.options),
    UsersModule,
    CronModule,
    AuthModule,
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
