import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ValidationMessages } from 'src/constants/validation.constants';

export class CognitoSignUpDto {
  @IsNotEmpty({ message: ValidationMessages.email.required })
  @IsEmail({}, { message: ValidationMessages.email.invalid })
  email: string;

  @IsNotEmpty({ message: ValidationMessages.password.required })
  @IsString({ message: ValidationMessages.password.type })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message: ValidationMessages.password.complexity,
    },
  )
  password: string;

  @IsNotEmpty({ message: ValidationMessages.name.required })
  @IsString()
  name: string;

  @IsOptional()
  @IsString({ message: ValidationMessages.role.type })
  role?: string;
}
