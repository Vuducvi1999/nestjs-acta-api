import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { CommissionLevel, CommissionStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { QueryOptions } from '../types/commission.types';

export class CommissionQueryDto implements QueryOptions {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  beneficiaryId?: string;

  @IsOptional()
  @IsEnum(CommissionLevel)
  commissionLevel?: CommissionLevel;

  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(1000)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeOrders?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(20)
  orderLimit?: number = 5;
}
