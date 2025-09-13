import { NewsCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { NewsPageType } from './constant';

export class NewsQueryDto {
  @IsOptional()
  @IsString()
  category?: NewsCategory;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsString()
  searchQuery?: string;

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
  @IsString()
  sortBy?: string;
}
