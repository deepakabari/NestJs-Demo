import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  GetUserCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { CognitoSignUpDto } from './dto/cognito-signup.dto';
import { CognitoLoginDto } from './dto/cognito-login.dto';
import { CognitoConfirmDto } from './dto/cognito-confirm.dto';
import { messages } from 'src/constants/messages.constants';

@Injectable()
export class CognitoAuthService {
  private readonly cognitoClient: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
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
    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        SecretHash: this.computeSecretHash(dto.email),
        Username: dto.email,
        Password: dto.password,
        UserAttributes: [
          { Name: 'email', Value: dto.email },
          { Name: 'name', Value: dto.name },
          ...(dto.role ? [{ Name: 'custom:role', Value: dto.role }] : []),
        ],
      });

      const result = await this.cognitoClient.send(command);

      return {
        message: messages.COGNITO_SIGNUP_SUCCESS,
        userSub: result.UserSub,
        isConfirmed: result.UserConfirmed,
      };
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      throw new UnauthorizedException(messages.COGNITO_TOKEN_INVALID);
    }
  }

  /**
   * Handle Cognito-specific errors and map to NestJS exceptions.
   */
  private handleCognitoError(error: any): never {
    const cognitoErrorMap: Record<string, { status: 'bad_request' | 'unauthorized' | 'server'; message: string }> = {
      UsernameExistsException: { status: 'bad_request', message: messages.COGNITO_USER_EXISTS },
      UserNotFoundException: { status: 'bad_request', message: messages.COGNITO_USER_NOT_FOUND },
      NotAuthorizedException: { status: 'unauthorized', message: messages.COGNITO_NOT_AUTHORIZED },
      CodeMismatchException: { status: 'bad_request', message: messages.COGNITO_CODE_MISMATCH },
      ExpiredCodeException: { status: 'bad_request', message: messages.COGNITO_CODE_EXPIRED },
      UserNotConfirmedException: { status: 'bad_request', message: messages.COGNITO_USER_NOT_CONFIRMED },
      InvalidPasswordException: { status: 'bad_request', message: messages.COGNITO_INVALID_PASSWORD },
      TooManyRequestsException: { status: 'bad_request', message: messages.COGNITO_TOO_MANY_REQUESTS },
    };

    const mapped = cognitoErrorMap[error.name];

    if (mapped) {
      switch (mapped.status) {
        case 'bad_request':
          throw new BadRequestException(mapped.message);
        case 'unauthorized':
          throw new UnauthorizedException(mapped.message);
      }
    }

    // Fallback for unmapped Cognito errors
    throw new InternalServerErrorException(error.message || messages.INTERNAL_SERVER_ERROR);
  }
}
