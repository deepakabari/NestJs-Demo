import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ValidationMessages } from '../../../constants/validation.constants';

export class CognitoSignUpDto {
  @IsNotEmpty({ message: ValidationMessages.email.required })
  @IsEmail({}, { message: ValidationMessages.email.invalid })
  email: string;

  @IsNotEmpty({ message: ValidationMessages.password.required })
  @IsString({ message: ValidationMessages.password.type })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: ValidationMessages.password.complexity,
  })
  password: string;

  @IsNotEmpty({ message: ValidationMessages.first_name.required })
  @IsString()
  first_name: string;

  @IsNotEmpty({ message: ValidationMessages.last_name.required })
  @IsString()
  last_name: string;

  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @IsOptional()
  @IsString()
  mnemonic?: string;

  @IsOptional()
  @IsBoolean()
  marketing_consent?: boolean;
}
