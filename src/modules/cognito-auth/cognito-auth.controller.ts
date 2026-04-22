import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { CognitoAuthService } from './cognito-auth.service';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { CognitoAuthGuard } from './guards/cognito-auth.guard';
import { messages } from 'src/constants/messages.constants';

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
  confirmSignUp(@Body() dto: CognitoConfirmDto) {
    return this.cognitoAuthService.confirmSignUp(dto);
  }

  /**
   * POST /cognito-auth/login
   * Authenticate user and receive Cognito tokens.
   */
  @Post('login')
  login(@Body() dto: CognitoLoginDto) {
    return this.cognitoAuthService.login(dto);
  }

  /**
   * GET /cognito-auth/verify-token
   * Verifies the access token passed in the Authorization header.
   * Uses the Cognito JWT guard (passport strategy) for validation.
   */
  @Get('verify-token')
  @UseGuards(CognitoAuthGuard)
  verifyToken(@Req() req: any) {
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
