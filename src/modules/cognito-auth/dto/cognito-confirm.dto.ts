import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ValidationMessages } from 'src/constants/validation.constants';

export class CognitoConfirmDto {
  @IsNotEmpty({ message: ValidationMessages.email.required })
  @IsEmail({}, { message: ValidationMessages.email.invalid })
  email: string;

  @IsNotEmpty({ message: 'Confirmation code is required.' })
  @IsString()
  confirmationCode: string;
}
