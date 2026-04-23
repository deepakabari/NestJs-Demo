import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { CognitoAuthModule } from './modules/cognito-auth/cognito-auth.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './config/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(AppDataSource.options),
    CognitoAuthModule,
    UsersModule,
  ],
})
export class AppModule {}
