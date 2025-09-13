import { IsEnum, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { NotificationAction, RelatedModel } from '@prisma/client';

export class NotificationQueryDto {
  @IsOptional()
  @IsEnum(RelatedModel)
  relatedModel?: RelatedModel;

  @IsOptional()
  @IsEnum(NotificationAction)
  action?: NotificationAction;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  isRead?: boolean;

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
}
