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
import { CognitoAuthService } from './cognito-auth.service';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';
import { AuthGuard } from '@nestjs/passport';
import { messages } from 'src/constants/messages.constants';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import { ForgotPasswordDto, ResetPasswordDto, RefreshTokenDto } from './dto/cognito-auth-extras.dto';
import { RequestWithCognitoUser } from 'src/interfaces/auth.interface';

@Controller('cognito-auth')
export class CognitoAuthController {
  constructor(private readonly cognitoAuthService: CognitoAuthService) {}

  /**
   * POST /cognito-auth/signup
   * Register a new user via Cognito. A verification code will be emailed.
   */
  @Post('signup')
  signUp(@Body() dto: CognitoSignUpDto) {
    return this.cognitoAuthService.signUp(dto);
  }

  /**
   * POST /cognito-auth/confirm
   * Confirm user registration with the verification code.
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirmSignUp(@Body() dto: CognitoConfirmDto) {
    return this.cognitoAuthService.confirmSignUp(dto);
  }

  /**
   * POST /cognito-auth/login
   * Authenticate user and receive Cognito tokens.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: CognitoLoginDto) {
    return this.cognitoAuthService.login(dto);
  }

  /**
   * POST /cognito-auth/forgot-password
   * Request a password reset code.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.cognitoAuthService.forgotPassword(dto);
  }

  /**
   * POST /cognito-auth/reset-password
   * Reset password using the code.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.cognitoAuthService.confirmForgotPassword(dto);
  }

  /**
   * POST /cognito-auth/resend-code
   * Resend the verification code.
   */
  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  resendCode(@Body('email') email: string) {
    return this.cognitoAuthService.resendConfirmationCode(email);
  }

  /**
   * POST /cognito-auth/refresh-tokens
   * Get a new access token using a refresh token.
   */
  @Post('refresh-tokens')
  @HttpCode(HttpStatus.OK)
  refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.cognitoAuthService.refreshTokens(dto);
  }

  /**
   * GET /cognito-auth/verify-token
   * Verifies the access token passed in the Authorization header.
   * Uses the Cognito JWT guard (passport strategy) for validation.
   */
  @Get('verify-token')
  @UseGuards(AuthGuard('cognito-jwt'))
  verifyToken(@Req() req: RequestWithCognitoUser) {
    return {
      message: messages.COGNITO_TOKEN_VALID,
      user: req.user,
    };
  }

  /**
   * GET /cognito-auth/me
   * Returns user info from Cognito using the access token directly.
   * This calls Cognito's GetUser API to retrieve user attributes.
   */
  @Get('me')
  getMe(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_MISSING);
    }

    const token = authHeader.replace('Bearer ', '');
    return this.cognitoAuthService.verifyToken(token);
  }
}
