import {
  AttributeType,
  AuthFlowType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  GetUserCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { messages } from '../../constants/messages.constants';
import { UsersService } from '../users/users.service';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/cognito-auth-extras.dto';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';

@Injectable()
export class CognitoAuthService {
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.userPoolId = this.configService.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.clientId = this.configService.getOrThrow<string>('COGNITO_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow<string>('COGNITO_CLIENT_SECRET');

    this.cognitoClient = new CognitoIdentityProviderClient({ region });
  }

  /**
   * Compute the SECRET_HASH required when the app client has a secret.
   */
  private computeSecretHash(username: string): string {
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  /**
   * Sign up a new user in Cognito.
   * A verification code will be sent to the user's email.
   */
  async signUp(dto: CognitoSignUpDto) {
    // 1. Check if user already exists in local database to prevent orphaned records
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException(messages.DUPLICATE_EMAIL);
    }

    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        Password: dto.password,
        UserAttributes: [
          { Name: 'email', Value: dto.email },
          { Name: 'given_name', Value: dto.firstName },
          { Name: 'family_name', Value: dto.lastName },
          { Name: 'phone_number', Value: dto.phoneNumber },
        ],
      });

      const result = await this.cognitoClient.send(command);

      // Save user to local database
      await this.usersService.create({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        cognitoSub: result.UserSub,
        mnemonic: dto.mnemonic,
      });

      return {
        message: messages.COGNITO_SIGNUP_SUCCESS,
        userSub: result.UserSub,
        isConfirmed: result.UserConfirmed,
      };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Confirm user sign-up with the verification code sent to email.
   */
  async confirmSignUp(dto: CognitoConfirmDto) {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        ConfirmationCode: dto.confirmationCode,
      });

      await this.cognitoClient.send(command);

      return {
        message: messages.COGNITO_CONFIRM_SUCCESS,
      };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Authenticate a user and return Cognito tokens.
   */
  async login(dto: CognitoLoginDto) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: dto.email,
          PASSWORD: dto.password,
          SECRET_HASH: this.computeSecretHash(dto.email),
        },
      });

      const result = await this.cognitoClient.send(command);

      if (!result.AuthenticationResult) {
        throw new UnauthorizedException(messages.COGNITO_AUTH_FAILED);
      }

      return {
        accessToken: result.AuthenticationResult.AccessToken,
        idToken: result.AuthenticationResult.IdToken,
        refreshToken: result.AuthenticationResult.RefreshToken,
        expiresIn: result.AuthenticationResult.ExpiresIn,
        tokenType: result.AuthenticationResult.TokenType,
      };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Request a password reset code.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
      });

      await this.cognitoClient.send(command);
      return { message: 'Password reset code sent to your email.' };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Confirm password reset with code and new password.
   */
  async confirmForgotPassword(dto: ResetPasswordDto) {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        ConfirmationCode: dto.confirmationCode,
        Password: dto.newPassword,
      });

      await this.cognitoClient.send(command);
      return { message: 'Password has been reset successfully.' };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Resend the signup confirmation code.
   */
  async resendConfirmationCode(email: string) {
    try {
      const command = new ResendConfirmationCodeCommand({
        ClientId: this.clientId,
        SecretHash: this.computeSecretHash(email),
        Username: email,
      });

      await this.cognitoClient.send(command);
      return { message: 'Confirmation code resent successfully.' };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Refresh Access Token using Refresh Token.
   */
  async refreshTokens(dto: RefreshTokenDto) {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: dto.refreshToken,
          SECRET_HASH: this.computeSecretHash(dto.email),
        },
      });

      const result = await this.cognitoClient.send(command);
      return {
        accessToken: result.AuthenticationResult?.AccessToken,
        idToken: result.AuthenticationResult?.IdToken,
        expiresIn: result.AuthenticationResult?.ExpiresIn,
      };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Update User Attributes in Cognito.
   */
  async updateProfile(accessToken: string, attributes: { firstName?: string; lastName?: string }) {
    try {
      const userAttributes: AttributeType[] = [];
      if (attributes.firstName)
        userAttributes.push({ Name: 'given_name', Value: attributes.firstName });
      if (attributes.lastName)
        userAttributes.push({ Name: 'family_name', Value: attributes.lastName });

      if (userAttributes.length === 0) return;

      const command = new UpdateUserAttributesCommand({
        AccessToken: accessToken,
        UserAttributes: userAttributes,
      });

      await this.cognitoClient.send(command);
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Verify the access token by calling Cognito's GetUser API.
   * Returns user attributes if the token is valid.
   */
  async verifyToken(accessToken: string) {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken,
      });

      const result = await this.cognitoClient.send(command);

      const attributes: Record<string, string> = {};
      result.UserAttributes?.forEach((attr) => {
        if (attr.Name && attr.Value) {
          attributes[attr.Name] = attr.Value;
        }
      });

      return {
        username: result.Username,
        attributes,
      };
    } catch {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }
  }

  /**
   * Handle Cognito-specific errors and map to NestJS exceptions.
   */
  private handleCognitoError(error: unknown): never {
    const cognitoErrorMap: Record<
      string,
      { status: 'bad_request' | 'unauthorized' | 'server'; message: string }
    > = {
      UsernameExistsException: {
        status: 'bad_request',
        message: messages.COGNITO_USER_EXISTS,
      },
      UserNotFoundException: {
        status: 'bad_request',
        message: messages.COGNITO_USER_NOT_FOUND,
      },
      NotAuthorizedException: {
        status: 'unauthorized',
        message: messages.COGNITO_NOT_AUTHORIZED,
      },
      CodeMismatchException: {
        status: 'bad_request',
        message: messages.COGNITO_CODE_MISMATCH,
      },
      ExpiredCodeException: {
        status: 'bad_request',
        message: messages.COGNITO_CODE_EXPIRED,
      },
      UserNotConfirmedException: {
        status: 'bad_request',
        message: messages.COGNITO_USER_NOT_CONFIRMED,
      },
      InvalidPasswordException: {
        status: 'bad_request',
        message: messages.COGNITO_INVALID_PASSWORD,
      },
      TooManyRequestsException: {
        status: 'bad_request',
        message: messages.COGNITO_TOO_MANY_REQUESTS,
      },
    };

    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const mapped = cognitoErrorMap[errorName];

    if (mapped) {
      switch (mapped.status) {
        case 'bad_request':
          throw new BadRequestException(mapped.message);
        case 'unauthorized':
          throw new UnauthorizedException(mapped.message);
      }
    }

    // Fallback for unmapped Cognito errors
    const errorMessage = error instanceof Error ? error.message : null;
    throw new InternalServerErrorException(errorMessage || messages.INTERNAL_SERVER_ERROR);
  }
}
