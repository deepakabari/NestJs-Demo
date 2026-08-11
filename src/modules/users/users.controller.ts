import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../common/decoraters/get-user.decorator';
import { messages } from '../../constants/messages.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { User } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly users_service: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Duplicate email' })
  async create(@Body() create_user_dto: CreateUserDto) {
    const user = await this.users_service.create(create_user_dto);
    return { message: messages.USER_CREATED, data: user };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns the user profile' })
  getMyProfile(@GetUser() user: User) {
    return { message: messages.USER_FETCHED, data: user };
  }

  @Get()
  @ApiOperation({ summary: 'List all users with pagination and search' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email or name' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'Users fetched successfully' })
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.users_service.findAll({
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
    return { message: messages.USERS_FETCHED, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User details fetched successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.users_service.findOne(id);
    return { message: messages.USER_FETCHED, data: user };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@GetUser('id') user_id: number, @Body() update_user_dto: UpdateUserDto) {
    const user = await this.users_service.update(user_id, update_user_dto);
    return { message: messages.PROFILE_UPDATED, data: user };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() update_user_dto: UpdateUserDto) {
    const user = await this.users_service.update(id, update_user_dto);
    return { message: messages.USER_UPDATED, data: user };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.users_service.remove(id);
    return { message: messages.USER_DELETED, data: null };
  }
}
