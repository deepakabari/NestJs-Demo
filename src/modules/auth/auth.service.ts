import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { messages } from '../../constants/messages.constants';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private users_service: UsersService,
    private jwt_service: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const existing_user = await this.users_service.findByEmail(signupDto.email);
    if (existing_user) {
      throw new ConflictException('Email already in use');
    }

    const hashed_password = await bcrypt.hash(signupDto.password, 10);

    const user = await this.users_service.create({
      email: signupDto.email,
      password: hashed_password,
      first_name: signupDto.first_name,
      last_name: signupDto.last_name,
    });

    return {
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.users_service.findByEmail(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException(messages.INVALID_CREDENTIALS);
    }

    const is_valid = await bcrypt.compare(loginDto.password, user.password);

    if (!is_valid) {
      throw new UnauthorizedException(messages.INVALID_CREDENTIALS);
    }

    const payload = { user_id: user.id, email: user.email };

    return {
      access_token: this.jwt_service.sign(payload),
    };
  }
}
