import { IsString, IsOptional } from 'class-validator';

export class UserHandleRequestActionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}