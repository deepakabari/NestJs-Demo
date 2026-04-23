import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ValidationMessages } from '../../../constants/validation.constants';

export class CreateUserDto {
  @IsNotEmpty({ message: ValidationMessages.email.required })
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  cognitoSub?: string;

  @IsOptional()
  @IsString()
  mnemonic?: string;
}
