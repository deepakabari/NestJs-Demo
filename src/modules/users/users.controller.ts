import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  forwardRef,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../../common/decoraters/get-user.decorator';
import { messages } from '../../constants/messages.constants';
import { CognitoAuthService } from '../cognito-auth/cognito-auth.service';
import { CognitoJwtGuard } from '../cognito-auth/guards/cognito-jwt.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { RevealMnemonicDto } from './dto/reveal-mnemonic.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(CognitoJwtGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => CognitoAuthService))
    private readonly cognitoAuthService: CognitoAuthService,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { message: messages.USER_CREATED, data: user };
  }

  @Get('my-id')
  getMyId(@GetUser('id') userId: number) {
    return { userId };
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.usersService.findAll({
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
    return { message: messages.USERS_FETCHED, data: result };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(+id);
    return { message: messages.USER_FETCHED, data: user };
  }

  /**
   * Securely reveals the mnemonic for the authenticated user.
   * Requires ownership check and audit logging for production grade security.
   */
  @Post(':id/mnemonic')
  @HttpCode(HttpStatus.OK)
  async revealMnemonic(
    @Param('id') id: string,
    @GetUser('id') currentUserId: number,
    @Body() revealMnemonicDto: RevealMnemonicDto,
  ) {
    const targetUserId = +id;

    // 1. Strict Ownership Check: Only users can reveal their own mnemonic
    if (currentUserId !== targetUserId) {
      this.logger.error(
        `[SECURITY] Unauthorized reveal attempt: User ${currentUserId} tried to access mnemonic for User ${targetUserId}`,
      );
      throw new ForbiddenException(messages.ACCESS_DENIED);
    }

    // 2. Audit Logging: Every access to sensitive plain-text data must be logged
    this.logger.warn(`[AUDIT] User ${currentUserId} requested mnemonic reveal.`);

    const mnemonic = await this.usersService.revealMnemonic(targetUserId, revealMnemonicDto?.pin);
    return { message: messages.MNEMONIC_REVEALED, data: { mnemonic } };
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

    return { message: messages.PROFILE_UPDATED, data: user };
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

    return { message: messages.USER_UPDATED, data: user };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.remove(+id);
    return { message: messages.USER_DELETED, data: null };
  }
}
