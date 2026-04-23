import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ValidationMessages } from 'src/constants/validation.constants';

export class ForgotPasswordDto {
  @IsEmail({}, { message: ValidationMessages.email.invalid })
  @IsNotEmpty({ message: ValidationMessages.email.required })
  email: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: ValidationMessages.email.invalid })
  @IsNotEmpty({ message: ValidationMessages.email.required })
  email: string;

  @IsNotEmpty()
  @IsString()
  confirmationCode: string;

  @IsNotEmpty({ message: ValidationMessages.password.required })
  @IsString({ message: ValidationMessages.password.type })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: ValidationMessages.password.complexity,
  })
  newPassword: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
