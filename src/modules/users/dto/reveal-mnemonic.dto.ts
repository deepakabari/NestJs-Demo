import { IsOptional, IsString } from 'class-validator';

export class RevealMnemonicDto {
  @IsOptional()
  @IsString()
  pin?: string;
}
