import {
  IsNotEmpty,
  IsOptional,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateUserRequest {
  @IsOptional()
  @IsNotEmpty()
  @Matches(RegExp('^[a-zA-Z0-9\\-]+$'))
  @MaxLength(20)
  email?: string;

  @IsOptional()
  @IsNotEmpty()
  @MaxLength(40)
  fullName?: string;

  @IsOptional()
  @IsUrl()
  image?: string;

  @IsOptional()
  @Matches(RegExp('([12]\\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01]))'))
  dob?: string; // ISO Date
}
