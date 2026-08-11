import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsOptional()
  first_name?: string;

  @IsOptional()
  last_name?: string;
}
