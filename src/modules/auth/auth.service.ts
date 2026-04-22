import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/modules/users/entities/user.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

interface Auth0SignupResponse {
  _id: string;
  email: string;
  name?: string;
  nickname?: string;
  description?: string; // Auth0 error description
  message?: string; // Fallback message
}

interface Auth0LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
  message?: string;
}

@Injectable()
export class AuthService {
  private readonly auth0Domain: string;
  private readonly auth0ClientId: string;
  private readonly auth0ClientSecret: string;
  private readonly auth0Audience: string;

  constructor(private readonly configService: ConfigService) {
    this.auth0Domain = this.configService.get<string>('AUTH0_DOMAIN')!;
    this.auth0ClientId = this.configService.get<string>('AUTH0_CLIENT_ID')!;
    this.auth0ClientSecret = this.configService.get<string>(
      'AUTH0_CLIENT_SECRET',
    )!;
    this.auth0Audience = this.configService.get<string>('AUTH0_AUDIENCE')!;
  }

  /**
   * Register a new user via Auth0's Database Connection.
   * This creates the user in Auth0's internal database.
   */
  async signup(signupDto: SignupDto) {
    const response = await fetch(
      `https://${this.auth0Domain}/dbconnections/signup`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.auth0ClientId,
          email: signupDto.email,
          password: signupDto.password,
          connection: 'Username-Password-Authentication',
          name: signupDto.name ?? signupDto.email.split('@')[0],
        }),
      },
    );

    const data = (await response.json()) as Auth0SignupResponse;

    if (!response.ok) {
      throw new BadRequestException(
        data.description ?? data.message ?? 'Signup failed',
      );
    }

    return {
      message: 'User registered successfully',
      user: {
        auth0Id: data._id,
        email: data.email,
        name: data.name ?? data.nickname,
      },
    };
  }

  /**
   * Authenticate a user via Auth0's Resource Owner Password Grant.
   * Returns an access_token that can be used with GET /auth/profile.
   */
  async login(loginDto: LoginDto) {
    const response = await fetch(`https://${this.auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username: loginDto.email,
        password: loginDto.password,
        audience: this.auth0Audience,
        client_id: this.auth0ClientId,
        client_secret: this.auth0ClientSecret,
        realm: 'Username-Password-Authentication',
        scope: 'openid profile email',
      }),
    });

    const data = (await response.json()) as Auth0LoginResponse;

    if (!response.ok) {
      if (data.error === 'invalid_grant') {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw new BadRequestException(
        data.error_description ?? data.message ?? 'Login failed',
      );
    }

    return {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    };
  }

  /**
   * Format user profile data for the response.
   */
  getProfile(user: User) {
    return {
      id: user.id,
      auth0Id: user.auth0Id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };
  }
}
