import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class PublicBusinessQueryDto {
  @IsOptional()
  @IsString()
  q?: string; // search by name/description/specialty (text index)

  @IsOptional()
  @IsString()
  categoryId?: string; // filter: carries products in category

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',')
      : Array.isArray(value)
        ? value
        : [],
  )
  specialty?: string[]; // tags

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  verified?: boolean;

  // KPI filters
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  minRating?: number; // 0..5

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  maxDeliverySlaMinutes?: number; // e.g., <= 120

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  minProductCount?: number;

  // Paging & sorting (mirrors your product query style)
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  page?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  pageSize?: number;

  @IsOptional()
  @IsEnum(['name', 'rating', 'productCount', 'growthRate', 'createdAt'])
  sortBy?: 'name' | 'rating' | 'productCount' | 'growthRate' | 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
