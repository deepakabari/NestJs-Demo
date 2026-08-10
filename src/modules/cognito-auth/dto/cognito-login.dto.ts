import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ValidationMessages } from '../../../constants/validation.constants';

export class CognitoLoginDto {
  @IsNotEmpty({ message: ValidationMessages.email.required })
  @IsEmail({}, { message: ValidationMessages.email.invalid })
  email: string;

  @IsNotEmpty({ message: ValidationMessages.password.required })
  @IsString({ message: ValidationMessages.password.type })
  password: string;
}
