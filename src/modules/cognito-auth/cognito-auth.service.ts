import {
  AttributeType,
  AuthFlowType,
  ChangePasswordCommand,
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
  ChangePasswordDto,
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/cognito-auth-extras.dto';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';

@Injectable()
export class CognitoAuthService {
  private readonly cognito_client: CognitoIdentityProviderClient;
  private readonly user_pool_id: string;
  private readonly client_id: string;
  private readonly client_secret: string;

  constructor(
    private readonly config_service: ConfigService,
    private readonly users_service: UsersService,
  ) {
    const region = this.config_service.get<string>('AWS_REGION', 'us-east-1');
    this.user_pool_id = this.config_service.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.client_id = this.config_service.getOrThrow<string>('COGNITO_CLIENT_ID');
    this.client_secret = this.config_service.getOrThrow<string>('COGNITO_CLIENT_SECRET');

    this.cognito_client = new CognitoIdentityProviderClient({ region });
  }

  /**
   * Compute the SECRET_HASH required when the app client has a secret.
   */
  private computeSecretHash(username: string): string {
    return createHmac('sha256', this.client_secret)
      .update(username + this.client_id)
      .digest('base64');
  }

  /**
   * Sign up a new user in Cognito.
   * A verification code will be sent to the user's email.
   */
  async signUp(dto: CognitoSignUpDto) {
    // 1. Check if user already exists in local database to prevent orphaned records
    const existing_user = await this.users_service.findByEmail(dto.email);
    if (existing_user) {
      throw new BadRequestException(messages.DUPLICATE_EMAIL);
    }

    try {
      const command = new SignUpCommand({
        ClientId: this.client_id,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        Password: dto.password,
        UserAttributes: [
          { Name: 'email', Value: dto.email },
          { Name: 'given_name', Value: dto.first_name },
          { Name: 'family_name', Value: dto.last_name },
          { Name: 'phone_number', Value: dto.phone_number },
        ],
      });

      const result = await this.cognito_client.send(command);

      // Save user to local database
      await this.users_service.create({
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        cognito_sub: result.UserSub,
        mnemonic: dto.mnemonic,
      });

      return {
        message: messages.COGNITO_SIGNUP_SUCCESS,
        data: {
          user_sub: result.UserSub,
          is_confirmed: result.UserConfirmed,
        },
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
        ClientId: this.client_id,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        ConfirmationCode: dto.confirmation_code,
      });

      await this.cognito_client.send(command);

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
        ClientId: this.client_id,
        AuthParameters: {
          USERNAME: dto.email,
          PASSWORD: dto.password,
          SECRET_HASH: this.computeSecretHash(dto.email),
        },
      });

      const result = await this.cognito_client.send(command);

      if (!result.AuthenticationResult) {
        throw new UnauthorizedException(messages.COGNITO_AUTH_FAILED);
      }

      return {
        message: messages.COGNITO_LOGIN_SUCCESS,
        data: {
          access_token: result.AuthenticationResult.AccessToken,
          expires_in: result.AuthenticationResult.ExpiresIn,
          token_type: result.AuthenticationResult.TokenType,
        },
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
        ClientId: this.client_id,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
      });

      await this.cognito_client.send(command);
      return { message: messages.COGNITO_PASSWORD_RESET_CODE_SENT };
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
        ClientId: this.client_id,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        ConfirmationCode: dto.confirmation_code,
        Password: dto.new_password,
      });

      await this.cognito_client.send(command);
      return { message: messages.COGNITO_PASSWORD_RESET_SUCCESS };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Change password for an authenticated user using their access token.
   */
  async changePassword(access_token: string, dto: ChangePasswordDto) {
    try {
      const command = new ChangePasswordCommand({
        AccessToken: access_token,
        PreviousPassword: dto.current_password,
        ProposedPassword: dto.new_password,
      });

      await this.cognito_client.send(command);
      return { message: messages.COGNITO_CHANGE_PASSWORD_SUCCESS };
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
        ClientId: this.client_id,
        SecretHash: this.computeSecretHash(email),
        Username: email,
      });

      await this.cognito_client.send(command);
      return { message: messages.COGNITO_CODE_RESENT };
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
        ClientId: this.client_id,
        AuthParameters: {
          REFRESH_TOKEN: dto.refresh_token,
          SECRET_HASH: this.computeSecretHash(dto.email),
        },
      });

      const result = await this.cognito_client.send(command);
      return {
        access_token: result.AuthenticationResult?.AccessToken,
        id_token: result.AuthenticationResult?.IdToken,
        expires_in: result.AuthenticationResult?.ExpiresIn,
      };
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Update User Attributes in Cognito.
   */
  async updateProfile(
    access_token: string,
    attributes: { first_name?: string; last_name?: string },
  ) {
    try {
      const user_attributes: AttributeType[] = [];
      if (attributes.first_name)
        user_attributes.push({ Name: 'given_name', Value: attributes.first_name });
      if (attributes.last_name)
        user_attributes.push({ Name: 'family_name', Value: attributes.last_name });

      if (user_attributes.length === 0) return;

      const command = new UpdateUserAttributesCommand({
        AccessToken: access_token,
        UserAttributes: user_attributes,
      });

      await this.cognito_client.send(command);
    } catch (error: unknown) {
      this.handleCognitoError(error);
    }
  }

  /**
   * Verify the access token by calling Cognito's GetUser API.
   * Returns user attributes if the token is valid.
   */
  async verifyToken(access_token: string) {
    try {
      const command = new GetUserCommand({
        AccessToken: access_token,
      });

      const result = await this.cognito_client.send(command);

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
    const cognito_error_map: Record<
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

    const error_name = error instanceof Error ? error.name : 'UnknownError';
    const mapped = cognito_error_map[error_name];

    if (mapped) {
      switch (mapped.status) {
        case 'bad_request':
          throw new BadRequestException(mapped.message);
        case 'unauthorized':
          throw new UnauthorizedException(mapped.message);
      }
    }

    // Fallback for unmapped Cognito errors
    const error_message = error instanceof Error ? error.message : null;
    throw new InternalServerErrorException(error_message || messages.INTERNAL_SERVER_ERROR);
  }
}
