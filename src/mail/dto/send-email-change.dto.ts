import { IsEmail, IsString } from 'class-validator';

export class SendEmailChangeDto {
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsString()
  url: string;
}
