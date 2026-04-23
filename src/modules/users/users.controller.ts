import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../../common/decoraters/get-user.decorator';

import { CognitoAuthService } from '../cognito-auth/cognito-auth.service';
import { CognitoJwtGuard } from '../cognito-auth/guards/cognito-jwt.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(CognitoJwtGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => CognitoAuthService))
    private readonly cognitoAuthService: CognitoAuthService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('my-id')
  getMyId(@GetUser('id') userId: number) {
    return { userId };
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch('profile')
  async updateProfile(
    @GetUser('id') userId: number,
    @Body() updateUserDto: UpdateUserDto,
    @Headers('authorization') authHeader: string,
  ) {
    const user = await this.usersService.update(userId, updateUserDto);

    // Sync name changes to Cognito if token is provided
    if (authHeader && (updateUserDto.firstName || updateUserDto.lastName)) {
      const token = authHeader.replace('Bearer ', '');
      await this.cognitoAuthService.updateProfile(token, {
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
      });
    }

    return user;
  }


  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Headers('authorization') authHeader: string,
  ) {
    const user = await this.usersService.update(+id, updateUserDto);

    // Sync name changes to Cognito if token is provided
    if (authHeader && (updateUserDto.firstName || updateUserDto.lastName)) {
      const token = authHeader.replace('Bearer ', '');
      await this.cognitoAuthService.updateProfile(token, {
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
      });
    }

    return user;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
