import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole } from 'src/constants/user-roles.enum';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  auth0Id: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn([UserRole.USER, UserRole.ADMIN])
  @IsString()
  role?: UserRole;
}
