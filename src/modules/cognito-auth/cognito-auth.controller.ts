import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CognitoAuthService } from './cognito-auth.service';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';
import { AuthGuard } from '@nestjs/passport';
import { messages } from 'src/constants/messages.constants';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  ChangePasswordDto,
} from './dto/cognito-auth-extras.dto';
import { RequestWithCognitoUser } from 'src/interfaces/auth.interface';

@ApiTags('Cognito Auth')
@Controller('cognito-auth')
export class CognitoAuthController {
  constructor(private readonly cognito_auth_service: CognitoAuthService) {}

  /**
   * Register a new user via Cognito. A verification code will be emailed.
   */
  @Post('signup')
  @ApiOperation({ summary: 'Register a new user via Cognito' })
  @ApiResponse({ status: 201, description: 'Signup initiated, verification code sent to email' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email' })
  signUp(@Body() dto: CognitoSignUpDto) {
    return this.cognito_auth_service.signUp(dto);
  }

  /**
   * Confirm user registration with the verification code.
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm user registration with verification code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  confirmSignUp(@Body() dto: CognitoConfirmDto) {
    return this.cognito_auth_service.confirmSignUp(dto);
  }

  /**
   * Authenticate user and receive Cognito tokens.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and receive tokens' })
  @ApiResponse({ status: 200, description: 'Login successful, tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: CognitoLoginDto) {
    return this.cognito_auth_service.login(dto);
  }

  /**
   * Request a password reset code.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiResponse({ status: 200, description: 'Password reset code sent to email' })
  @ApiResponse({ status: 400, description: 'User not found' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.cognito_auth_service.forgotPassword(dto);
  }

  /**
   * Reset password using the code.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using verification code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code or weak password' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.cognito_auth_service.confirmForgotPassword(dto);
  }

  /**
   * Change password for an authenticated user.
   * Requires the current password and the new password.
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('cognito-jwt'))
  @ApiBearerAuth('cognito-jwt')
  @ApiOperation({ summary: 'Change password for an authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password or weak new password' })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or missing access token' })
  changePassword(@Headers('authorization') auth_header: string, @Body() dto: ChangePasswordDto) {
    const token = auth_header.replace('Bearer ', '');
    return this.cognito_auth_service.changePassword(token, dto);
  }

  /**
   * Resend the verification code.
   */
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend the signup verification code' })
  @ApiBody({ schema: { properties: { email: { type: 'string', example: 'test2@yopmail.com' } } } })
  @ApiResponse({ status: 200, description: 'Verification code resent' })
  resendCode(@Body('email') email: string) {
    return this.cognito_auth_service.resendConfirmationCode(email);
  }

  /**
   * Get a new access token using a refresh token.
   */
  @Post('refresh-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'New tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.cognito_auth_service.refreshTokens(dto);
  }

  /**
   * Verifies the access token passed in the Authorization header.
   * Uses the Cognito JWT guard (passport strategy) for validation.
   */
  @Get('verify-token')
  @UseGuards(AuthGuard('cognito-jwt'))
  @ApiBearerAuth('cognito-jwt')
  @ApiOperation({ summary: 'Verify access token validity' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid or expired' })
  verifyToken(@Req() req: RequestWithCognitoUser) {
    return {
      message: messages.COGNITO_TOKEN_VALID,
      data: { user: req.user },
    };
  }

  /**
   * Returns user info from Cognito using the access token directly.
   * This calls Cognito's GetUser API to retrieve user attributes.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get user info from Cognito via access token' })
  @ApiBearerAuth('cognito-jwt')
  @ApiResponse({ status: 200, description: 'User info returned' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  getMe(@Headers('authorization') auth_header: string) {
    if (!auth_header || !auth_header.startsWith('Bearer ')) {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_MISSING);
    }

    const token = auth_header.replace('Bearer ', '');
    return this.cognito_auth_service.verifyToken(token);
  }
}
