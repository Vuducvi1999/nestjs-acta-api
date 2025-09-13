import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDate,
  IsArray,
  IsDateString,
} from 'class-validator';
import { NewsCategory } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateNewsDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(NewsCategory)
  @IsOptional()
  category?: NewsCategory;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  date?: Date;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  videoUrls?: string[];

  @IsString()
  @IsOptional()
  slug?: string;

  @IsDateString()
  @IsOptional()
  createdAt?: string;
}
