import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsString()
  message?: string;
}
