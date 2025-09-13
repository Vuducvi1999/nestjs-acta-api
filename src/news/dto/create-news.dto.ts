import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDate,
  IsArray,
} from 'class-validator';
import { NewsCategory } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(NewsCategory)
  @IsNotEmpty()
  category: NewsCategory;

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

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  videoUrls?: string[];
}
