import { IsString, IsOptional } from 'class-validator';

export class CalculateCommissionDto {
  @IsString()
  orderId: string;

  @IsString()
  @IsOptional()
  processedBy?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
