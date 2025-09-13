import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDecimal,
  Min,
  Max,
} from 'class-validator';
import { CommissionLevel, CommissionStatus } from '@prisma/client';

export class CreateAffiliateCommissionDto {
  @IsString()
  orderId: string;

  @IsString()
  productId: string;

  @IsString()
  beneficiaryId: string;

  @IsEnum(CommissionLevel)
  commissionLevel: CommissionLevel;

  @IsDecimal()
  @Min(0)
  @Max(1)
  commissionRate: number;

  @IsDecimal()
  @Min(0)
  baseAmount: number;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsDecimal()
  @Min(0)
  commissionAmount: number;

  @IsString()
  categoryId: string;

  @IsEnum(CommissionStatus)
  @IsOptional()
  status?: CommissionStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
