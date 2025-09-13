import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';
import { ActivityTargetType, ActivityType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class ActivityLogQueryDto {
  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  targetType?: ActivityTargetType;

  @IsOptional()
  @IsString()
  activityType?: ActivityType;

  @IsOptional()
  @IsString()
  uploaderId?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  limit?: number = 10;

  @IsOptional()
  @IsString()
  searchQuery?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
