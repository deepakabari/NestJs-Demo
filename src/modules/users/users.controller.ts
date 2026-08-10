import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CookieAuthGuard } from '../../common/guards/cookie-auth.guard';
import { GetUser } from '../../common/decoraters/get-user.decorator';
import { messages } from '../../constants/messages.constants';
import { RequestWithCookies } from '../../interfaces/auth.interface';
import { CognitoAuthService } from '../cognito-auth/cognito-auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RevealMnemonicDto } from './dto/reveal-mnemonic.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@Controller('users')
@UseGuards(CookieAuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly users_service: UsersService,
    @Inject(forwardRef(() => CognitoAuthService))
    private readonly cognito_auth_service: CognitoAuthService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Duplicate email' })
  async create(@Body() create_user_dto: CreateUserDto) {
    const user = await this.users_service.create(create_user_dto);
    return { message: messages.USER_CREATED, data: user };
  }

  // TEST ENDPOINT: Quick bulk insert of dummy pending users to test the cron job
  @Post('test-bulk')
  @ApiOperation({ summary: 'TEST ONLY: Insert dummy pending users' })
  async createBulkDummyUsers() {
    const createdEmails: string[] = [];

    for (let i = 3; i < 4; i++) {
      const email = `test${i}@yopmail.com`;
      const password = 'Password123!';
      const first_name = `Test${i}`;
      const last_name = `User${i}`;

      try {
        // 1. Create in Cognito first to get sub and enable login
        const cognitoResult = await this.cognito_auth_service.adminCreateConfirmedUser({
          email,
          password,
          first_name,
          last_name,
        });

        // 2. Create in local database with status 'pending'
        await this.users_service.create({
          email,
          first_name,
          last_name,
          cognito_sub: cognitoResult?.userSub,
        });

        this.logger.log(`Successfully created dummy user: ${email}`);
        createdEmails.push(email);
      } catch (error) {
        this.logger.error(`Failed to create bulk user ${email}:`, error);
      }
    }
    return {
      message: 'Inserted pending users with Cognito accounts!',
      password: 'Password123!',
      emails: createdEmails,
    };
  }

  @Get('my-id')
  @ApiOperation({ summary: 'Get the authenticated user ID' })
  @ApiResponse({ status: 200, description: 'Returns the user ID' })
  getMyId(@GetUser('id') user_id: number) {
    return { user_id };
  }

  @Get()
  @ApiOperation({ summary: 'List all users with pagination and search' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email (exact match)' })
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
  async findOne(@Param('id') id: string) {
    const user = await this.users_service.findOne(id);
    return { message: messages.USER_FETCHED, data: user };
  }

  /**
   * Securely reveals the mnemonic for the authenticated user.
   * Requires ownership check and audit logging for production grade security.
   */
  @Post(':id/mnemonic')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reveal user mnemonic (owner only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Mnemonic revealed successfully' })
  @ApiResponse({ status: 403, description: 'Access denied — not the owner' })
  @ApiResponse({ status: 404, description: 'User or mnemonic not found' })
  async revealMnemonic(
    @Param('id') id: string,
    @GetUser('id') current_user_id: string,
    @Body() reveal_mnemonic_dto: RevealMnemonicDto,
  ) {
    const target_user_id = id;

    // 1. Strict Ownership Check: Only users can reveal their own mnemonic
    if (current_user_id !== target_user_id) {
      this.logger.error(
        `[SECURITY] Unauthorized reveal attempt: User ${current_user_id} tried to access mnemonic for User ${target_user_id}`,
      );
      throw new ForbiddenException(messages.ACCESS_DENIED);
    }

    // 2. Audit Logging: Every access to sensitive plain-text data must be logged
    this.logger.warn(`[AUDIT] User ${current_user_id} requested mnemonic reveal.`);

    const mnemonic = await this.users_service.revealMnemonic(
      target_user_id,
      reveal_mnemonic_dto?.pin,
    );
    return { message: messages.MNEMONIC_REVEALED, data: { mnemonic } };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @GetUser('id') user_id: string,
    @Body() update_user_dto: UpdateUserDto,
    @Req() req: RequestWithCookies,
  ) {
    const user = await this.users_service.update(user_id, update_user_dto);

    // Sync name changes to Cognito if token is provided
    const token = req.cookies?.['access_token'];
    if (token && (update_user_dto.first_name || update_user_dto.last_name)) {
      await this.cognito_auth_service.updateProfile(token, {
        first_name: update_user_dto.first_name,
        last_name: update_user_dto.last_name,
      });
    }

    return { message: messages.PROFILE_UPDATED, data: user };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() update_user_dto: UpdateUserDto,
    @Req() req: RequestWithCookies,
  ) {
    const user = await this.users_service.update(id, update_user_dto);

    // Sync name changes to Cognito if token is provided
    const token = req.cookies?.['access_token'];
    if (token && (update_user_dto.first_name || update_user_dto.last_name)) {
      await this.cognito_auth_service.updateProfile(token, {
        first_name: update_user_dto.first_name,
        last_name: update_user_dto.last_name,
      });
    }

    return { message: messages.USER_UPDATED, data: user };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string) {
    await this.users_service.remove(id);
    return { message: messages.USER_DELETED, data: null };
  }
}
