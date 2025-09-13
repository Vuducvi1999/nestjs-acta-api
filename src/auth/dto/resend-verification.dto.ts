import { IsEmail } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResendVerificationEmailDto {
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  email: string;
}
