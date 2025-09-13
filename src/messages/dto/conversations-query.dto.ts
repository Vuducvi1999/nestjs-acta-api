import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';

export class ConversationsQueryDto {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  page?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  limit?: number;

  @IsOptional()
  search?: string; // conversation name or user info

  @IsOptional()
  isGroup?: boolean;

  @IsOptional()
  unreadOnly?: boolean;
}
