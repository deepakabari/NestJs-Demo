import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole } from 'src/constants/user-roles.enum';

export class UpdateUserDto {
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
