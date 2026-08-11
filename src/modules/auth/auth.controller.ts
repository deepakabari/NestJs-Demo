import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth_service: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async signup(@Body() signupDto: SignupDto) {
    return this.auth_service.signup(signupDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and get a JWT token' })
  @ApiResponse({ status: 200, description: 'JWT token returned.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(@Body() loginDto: LoginDto) {
    return this.auth_service.login(loginDto);
  }
}
