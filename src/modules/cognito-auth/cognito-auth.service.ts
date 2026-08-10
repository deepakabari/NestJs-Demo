import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
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
  RevokeTokenCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
  UserNotConfirmedException,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { EMAIL_TYPE } from '../../constants/aws.constants';
import { messages } from '../../constants/messages.constants';
import { EmailService } from '../email/email.service';
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
import { CognitoJwtPayload } from '../../interfaces/auth.interface';

@Injectable()
export class CognitoAuthService {
  private readonly cognito_client: CognitoIdentityProviderClient;
  private readonly user_pool_id: string;
  private readonly client_id: string;
  private readonly client_secret: string;
  private readonly cognito_domain: string;
  private readonly callback_url: string;

  constructor(
    private readonly config_service: ConfigService,
    private readonly users_service: UsersService,
    private readonly email_service: EmailService,
  ) {
    const region = this.config_service.get<string>('AWS_REGION', 'us-east-1');
    this.user_pool_id = this.config_service.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.client_id = this.config_service.getOrThrow<string>('COGNITO_CLIENT_ID');
    this.client_secret = this.config_service.getOrThrow<string>('COGNITO_CLIENT_SECRET');
    this.cognito_domain = this.config_service.getOrThrow<string>('COGNITO_DOMAIN');
    this.callback_url = this.config_service.getOrThrow<string>('COGNITO_CALLBACK_URL');

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
      const local_user = await this.users_service.create({
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        cognito_sub: result.UserSub,
        mnemonic: dto.mnemonic,
      });

      // Set marketing consent if provided during signup
      if (dto.marketing_consent) {
        await this.users_service.updateMarketingConsent(local_user.id, true);
      }

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
   * Admin Create User (auto-confirmed with password)
   */
  async adminCreateConfirmedUser(dto: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) {
    try {
      // 1. Create the user in Cognito
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: this.user_pool_id,
        Username: dto.email,
        UserAttributes: [
          { Name: 'email', Value: dto.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: dto.first_name },
          { Name: 'family_name', Value: dto.last_name },
        ],
        MessageAction: 'SUPPRESS', // Don't send email
      });

      const result = await this.cognito_client.send(createCommand);
      const userSub = result.User?.Attributes?.find((attr) => attr.Name === 'sub')?.Value;

      // 2. Set the password as permanent
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: this.user_pool_id,
        Username: dto.email,
        Password: dto.password,
        Permanent: true,
      });

      await this.cognito_client.send(setPasswordCommand);

      return {
        userSub,
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

      // Fetch user to get name for the email
      const local_user = await this.users_service.findByEmail(dto.email);
      const name = local_user?.first_name || 'there';

      // Send a welcome email (fire and forget)
      this.email_service
        .sendEmail({
          type: EMAIL_TYPE.WELCOME,
          sendTo: dto.email,
          customData: { name },
        })
        .catch((err) => {
          console.error('Failed to send welcome email:', err);
        });

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

      const access_token = result.AuthenticationResult.AccessToken;

      // Decode the token to get the sub (immutable unique ID)
      if (!access_token) {
        throw new UnauthorizedException('Authentication failed, no access token received');
      }
      const payloadBase64 = access_token.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadBase64, 'base64').toString(),
      ) as CognitoJwtPayload;
      const sub = payload.sub;

      // Try finding by Sub (most reliable)
      let local_user = await this.users_service.findBySub(sub);

      // Fallback to Email if Sub not linked yet (Lazy Sync)
      if (!local_user) {
        local_user = await this.users_service.findByEmail(dto.email);
        if (local_user) {
          // Link the Cognito Sub to this user for future lookups
          await this.users_service.update(local_user.id, { cognito_sub: sub });
        }
      }

      return {
        message: messages.COGNITO_LOGIN_SUCCESS,
        data: {
          access_token: result.AuthenticationResult.AccessToken,
          refresh_token: result.AuthenticationResult.RefreshToken,
          expires_in: result.AuthenticationResult.ExpiresIn,
          token_type: result.AuthenticationResult.TokenType,
          user: local_user
            ? {
                id: local_user.id,
                email: local_user.email,
                first_name: local_user.first_name,
                last_name: local_user.last_name,
                marketing_consent: local_user.marketing_consent,
              }
            : null,
        },
      };
    } catch (error: unknown) {
      if (error instanceof UserNotConfirmedException) {
        // Automatically send the verification code to the user's email
        await this.resendConfirmationCode(dto.email);
        throw new UnauthorizedException({
          message: messages.COGNITO_UNCONFIRMED_CODE_SENT,
          is_unconfirmed: true,
        });
      }
      this.handleCognitoError(error);
    }
  }

  /**
   * Log out a user from the current device using their refresh token.
   */
  async logout(refresh_token: string) {
    try {
      const command = new RevokeTokenCommand({
        Token: refresh_token,
        ClientId: this.client_id,
        ClientSecret: this.client_secret,
      });

      await this.cognito_client.send(command);
      return { message: messages.COGNITO_LOGOUT_SUCCESS };
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
   * Refresh Access Token using Refresh Token (when we only have the sub).
   */
  async refreshTokensWithSub(sub: string, refresh_token: string) {
    try {
      const user = await this.users_service.findBySub(sub);
      if (!user) {
        throw new UnauthorizedException('User not found for refresh token');
      }

      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.client_id,
        AuthParameters: {
          REFRESH_TOKEN: refresh_token,
          SECRET_HASH: this.computeSecretHash(user.email),
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

      const email = attributes['email'];
      const local_user = email ? await this.users_service.findByEmail(email) : null;

      return {
        username: result.Username,
        attributes,
        local_user: local_user
          ? {
              id: local_user.id,
              status: local_user.status,
              publicKey: local_user.publicKey,
            }
          : null,
      };
    } catch {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }
  }

  // ─── Google OAuth Flow ───

  /**
   * Generate the Cognito Hosted UI URL to redirect the user for Google sign-in.
   */
  getGoogleAuthUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.client_id,
      redirect_uri: this.callback_url,
      identity_provider: 'Google',
      scope: 'email openid profile aws.cognito.signin.user.admin',
    });

    return `${this.cognito_domain}/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange the authorization code from Cognito callback for tokens.
   * Calls Cognito's /oauth2/token endpoint.
   */
  async exchangeCodeForTokens(code: string) {
    const token_url = `${this.cognito_domain}/oauth2/token`;

    // Basic Auth header: Base64(client_id:client_secret)
    const basic_auth = Buffer.from(`${this.client_id}:${this.client_secret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.client_id,
      redirect_uri: this.callback_url,
      code,
    });

    const response = await fetch(token_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic_auth}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error_body = await response.text();
      throw new BadRequestException(
        `${messages.COGNITO_GOOGLE_TOKEN_EXCHANGE_FAILED}: ${error_body}`,
      );
    }

    return (await response.json()) as {
      access_token: string;
      id_token?: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
    };
  }

  /**
   * Full Google OAuth callback handler.
   * 1. Exchanges the authorization code for tokens
   * 2. Retrieves user info from Cognito using the access token
   * 3. Creates or links the local user
   * 4. Returns the tokens and user info
   */
  async handleGoogleCallback(code: string) {
    // 1. Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code);

    // 2. Fetch user info from Cognito using the access token
    const user_info_url = `${this.cognito_domain}/oauth2/userInfo`;
    const user_info_response = await fetch(user_info_url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!user_info_response.ok) {
      throw new BadRequestException(messages.COGNITO_GOOGLE_TOKEN_EXCHANGE_FAILED);
    }

    const user_info = (await user_info_response.json()) as {
      email: string;
      sub: string;
      given_name?: string;
      family_name?: string;
    };
    const email: string = user_info.email;
    const cognito_sub: string = user_info.sub;
    const first_name: string = user_info.given_name || '';
    const last_name: string = user_info.family_name || '';

    // 3. Find or create local user
    let local_user = await this.users_service.findBySub(cognito_sub);
    let is_first_login = false;

    if (!local_user) {
      // Check if user exists by email (e.g., previously signed up with email/password)
      const existing_user = await this.users_service.findByEmail(email);

      if (existing_user) {
        // Link existing user to this Google Cognito sub
        local_user = await this.users_service.update(existing_user.id, {
          cognito_sub,
        });
      } else {
        // Create new user — this is their first login
        is_first_login = true;
        local_user = await this.users_service.create({
          email,
          first_name,
          last_name,
          cognito_sub,
        });
      }
    }

    // 4. Return tokens and user info
    return {
      message: messages.COGNITO_GOOGLE_LOGIN_SUCCESS,
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        is_first_login,
        user: {
          id: local_user.id,
          email: local_user.email,
          first_name: local_user.first_name,
          last_name: local_user.last_name,
          marketing_consent: local_user.marketing_consent,
        },
      },
    };
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
