import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';
import { TaxType } from '@prisma/client';

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  q?: string; // Search query for name or description

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    return Array.isArray(value) ? value : [];
  })
  categoryGroup?: string[];

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value;
  })
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    return value;
  })
  maxPrice?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
  })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
  })
  allowsSale?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
  })
  freeShipping?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value;
  })
  isRewardPoint?: boolean;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',');
    }
    return Array.isArray(value) ? value : [];
  })
  taxType?: TaxType[];

  @IsOptional()
  @IsString()
  source?: string; // 'acta' | 'kiotviet'

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
  pageSize?: number;

  @IsOptional()
  @IsEnum(['name', 'price', 'createdAt', 'updatedAt'])
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
