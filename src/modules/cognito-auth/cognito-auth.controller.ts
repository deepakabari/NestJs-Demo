import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { messages } from '../../constants/messages.constants';
import {
  CognitoJwtPayload,
  CognitoTokens,
  RequestWithCognitoUser,
  RequestWithCookies,
} from '../../interfaces/auth.interface';
import { CookieAuthGuard } from '../../common/guards/cookie-auth.guard';
import { CsrfMiddleware } from '../../common/middleware/csrf.middleware';
import { CognitoAuthService } from './cognito-auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/cognito-auth-extras.dto';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';
import { SessionService } from './session.service';

@ApiTags('Cognito Auth')
@Controller('cognito-auth')
export class CognitoAuthController {
  private readonly isProduction: boolean;
  private readonly csrfSecret: string;

  constructor(
    private readonly cognito_auth_service: CognitoAuthService,
    private readonly session_service: SessionService,
    private readonly config_service: ConfigService,
  ) {
    this.isProduction = this.config_service.get('NODE_ENV') === 'production';
    this.csrfSecret = this.config_service.getOrThrow<string>('CSRF_SECRET');
  }

  /**
   * Helper to set all auth cookies securely on the response
   */
  private setAuthCookies(res: Response, tokens: CognitoTokens, fingerprint: string) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
    };

    // 1. Access Token Cookie
    res.cookie('access_token', tokens.access_token, {
      ...cookieOptions,
      maxAge: (tokens.expires_in || 3600) * 1000,
    });

    // 2. Refresh Token Cookie (longer lived)
    res.cookie('refresh_token', tokens.refresh_token, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // 3. Fingerprint Cookie
    res.cookie('__fingerprint', fingerprint, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // 4. CSRF Token Cookie (NOT HttpOnly - must be readable by JS)
    const csrfToken = CsrfMiddleware.generateToken(this.csrfSecret);
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return csrfToken;
  }

  /**
   * Helper to clear all auth cookies on logout
   */
  private clearAuthCookies(res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict' as const,
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    res.clearCookie('__fingerprint', cookieOptions);
    res.clearCookie('csrf_token', { ...cookieOptions, httpOnly: false });
  }

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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and set secure cookies' })
  @ApiResponse({ status: 200, description: 'Login successful, cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: CognitoLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.cognito_auth_service.login(dto);

    // Generate and store fingerprint
    const fingerprint = this.session_service.generateFingerprint();
    const fingerprint_hash = this.session_service.hashFingerprint(fingerprint);

    // We get sub from the JWT payload decode directly for session creation
    // Alternatively, verifyToken to get sub, but we know login succeeded
    if (!result.data || !result.data.access_token) {
      throw new UnauthorizedException('Authentication failed, no access token received');
    }
    const payloadBase64 = result.data.access_token.split('.')[1];
    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString(),
    ) as CognitoJwtPayload;
    const sub = payload.sub;

    await this.session_service.createSession(sub, fingerprint_hash, result.data.user?.id);

    // Set cookies
    const csrfToken = this.setAuthCookies(res, result.data as CognitoTokens, fingerprint);

    return {
      message: result.message,
      data: {
        user: result.data.user,
        csrf_token: csrfToken, // Explicitly return CSRF token in body for JS client config
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Logout the authenticated user from the current device' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or missing token' })
  async logout(@Req() req: RequestWithCognitoUser, @Res({ passthrough: true }) res: Response) {
    // We use the refresh token from the cookie instead of the DTO
    const refresh_token = req.cookies['refresh_token'];

    if (refresh_token) {
      await this.cognito_auth_service.logout(refresh_token);
    }

    // Delete session from database
    const cognito_sub = req.user.sub;
    await this.session_service.deleteSessionsBySub(cognito_sub);

    // Clear all cookies
    this.clearAuthCookies(res);

    return { message: messages.COGNITO_LOGOUT_SUCCESS };
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

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Change password for an authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password or weak new password' })
  @ApiResponse({ status: 401, description: 'Unauthorized – invalid or missing access token' })
  changePassword(@Req() req: RequestWithCookies, @Body() dto: ChangePasswordDto) {
    const token = req.cookies['access_token'];
    if (!token) throw new UnauthorizedException(messages.COGNITO_TOKEN_MISSING);
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

  @Post('refresh-tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token and rotate fingerprint using cookie' })
  @ApiResponse({ status: 200, description: 'New tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshTokens(@Req() req: RequestWithCookies, @Res({ passthrough: true }) res: Response) {
    const refresh_token = req.cookies['refresh_token'];
    const old_fingerprint = req.cookies['__fingerprint'];

    if (!refresh_token || !old_fingerprint) {
      throw new UnauthorizedException('Missing refresh token or fingerprint cookie');
    }

    // 1. Decode refresh token without validation to get sub (sub is not validated yet, but Cognito will validate token)
    const payloadBase64 = refresh_token.split('.')[1];
    let payload: CognitoJwtPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString()) as CognitoJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token format');
    }
    const sub = payload.sub;

    // 2. Refresh tokens with Cognito
    // NOTE: In a real app we might need the user's email to compute the SecretHash for Cognito,
    // which refreshTokens might require. If so, we need to extract it or change how SecretHash is used.
    // For now we'll pass a dummy email and assume cognito_auth_service can handle sub/email.
    // Let's modify the DTO to not require email, or we fetch it from DB.

    // We fetch user to get email for the SecretHash in cognito_auth_service
    const result = await this.cognito_auth_service.refreshTokensWithSub(sub, refresh_token);

    if (!result.access_token) {
      throw new UnauthorizedException('Refresh failed, no access token received');
    }

    // 3. Rotate Fingerprint
    await this.session_service.deleteSessionByFingerprint(sub, old_fingerprint);
    const new_fingerprint = this.session_service.generateFingerprint();
    const new_fingerprint_hash = this.session_service.hashFingerprint(new_fingerprint);
    await this.session_service.createSession(sub, new_fingerprint_hash);

    // 4. Set new cookies
    const tokens: CognitoTokens = {
      access_token: result.access_token,
      refresh_token: refresh_token, // keep same refresh token usually, or get new if cognito returns one
      expires_in: result.expires_in || 3600,
    };

    const csrfToken = this.setAuthCookies(res, tokens, new_fingerprint);

    return {
      message: 'Tokens refreshed successfully',
      data: {
        csrf_token: csrfToken,
      },
    };
  }

  @Get('verify-token')
  @UseGuards(CookieAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Verify access token validity' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Token is invalid or expired' })
  verifyToken(@Req() req: RequestWithCognitoUser) {
    return {
      message: messages.COGNITO_TOKEN_VALID,
      data: { user: req.user },
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get user info from Cognito via access token' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'User info returned' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  async getMe(@Req() req: RequestWithCookies) {
    const token = req.cookies['access_token'];

    if (!token) {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_MISSING);
    }

    const cognitoUser = await this.cognito_auth_service.verifyToken(token);
    return cognitoUser;
  }

  // ─── Google OAuth Endpoints ───

  /**
   * Redirect the user to Google sign-in via Cognito Hosted UI.
   */
  @Get('google')
  @ApiOperation({ summary: 'Redirect to Google sign-in via Cognito Hosted UI' })
  @ApiResponse({ status: 302, description: 'Redirects to Google sign-in page' })
  googleLogin(@Res() res: Response) {
    const url = this.cognito_auth_service.getGoogleAuthUrl();
    return res.redirect(url);
  }

  @Get('google/callback')
  @ApiExcludeEndpoint()
  async googleCallback(@Query('code') code: string, @Res({ passthrough: true }) res: Response) {
    if (!code) {
      throw new BadRequestException(messages.COGNITO_GOOGLE_MISSING_CODE);
    }

    const result = await this.cognito_auth_service.handleGoogleCallback(code);

    // Generate and store fingerprint
    const fingerprint = this.session_service.generateFingerprint();
    const fingerprint_hash = this.session_service.hashFingerprint(fingerprint);

    // We should parse the JWT to be sure we have the sub
    if (!result.data || !result.data.access_token) {
      throw new UnauthorizedException('Authentication failed, no access token received');
    }
    const payloadBase64 = result.data.access_token.split('.')[1];
    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64').toString(),
    ) as CognitoJwtPayload;
    const cognito_sub = payload.sub;

    await this.session_service.createSession(cognito_sub, fingerprint_hash, result.data.user?.id);

    // Set cookies
    const csrfToken = this.setAuthCookies(res, result.data as CognitoTokens, fingerprint);

    return {
      message: result.message,
      data: {
        is_first_login: result.data.is_first_login,
        user: result.data.user,
        csrf_token: csrfToken,
      },
    };
  }
}
