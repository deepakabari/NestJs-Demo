import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ValidationMessages } from '../../../constants/validation.constants';

export class CreateUserDto {
  @IsNotEmpty({ message: ValidationMessages.email.required })
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;
}
