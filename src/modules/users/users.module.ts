import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { CognitoAuthModule } from '../cognito-auth/cognito-auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), forwardRef(() => CognitoAuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
