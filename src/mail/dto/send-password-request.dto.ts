import { IsEmail, IsString } from 'class-validator';

export class SendPasswordResetDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsString()
  token: string;
}
