import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RefundStatus } from '@prisma/client';

// DTO for refund item details (optional itemized refund)
export class RefundItemDto {
  @ApiProperty({
    description: 'Order detail ID to refund',
    example: 'order_detail_1234567890abcdef',
  })
  @IsString()
  orderDetailId: string;

  @ApiProperty({
    description: 'Quantity to refund',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}

// Create Refund DTO
export class CreateRefundDto {
  @ApiProperty({
    description: 'Payment ID to refund',
    example: 'pay_1234567890abcdef',
  })
  @IsString()
  paymentId: string;

  @ApiProperty({
    description: 'Refund amount in VND',
    example: 50000,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Reason for refund',
    example: 'Customer requested refund due to product defect',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiProperty({
    description: 'Itemized refund details (optional)',
    type: [RefundItemDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  items?: RefundItemDto[];
}

// Approve Refund DTO
export class ApproveRefundDto {
  @ApiProperty({
    description: 'Approval note',
    example: 'Approved by finance team after customer service review',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Settle Refund DTO (attach bank proof)
export class SettleRefundDto {
  @ApiProperty({
    description: 'Bank transfer ID / memo for settlement proof',
    example: 'TXN123456789',
  })
  @IsString()
  providerRef: string;

  @ApiProperty({
    description: 'Settlement date (defaults to now)',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  settledAt?: Date;
}

// Refund Response DTO
export class RefundResponseDto {
  @ApiProperty({
    description: 'Refund ID',
    example: 'refund_1234567890abcdef',
  })
  refundId: string;

  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_1234567890abcdef',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'order_1234567890abcdef',
  })
  orderId: string;

  @ApiProperty({
    description: 'Refund amount',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Refund status',
    enum: RefundStatus,
    example: 'requested',
  })
  status: RefundStatus;

  @ApiProperty({
    description: 'Refund reason',
    example: 'Customer requested refund due to product defect',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Bank transaction reference',
    example: 'TXN123456789',
    required: false,
  })
  providerRef?: string;

  @ApiProperty({
    description: 'Refund reference code',
    example: 'REF-2024-001',
    required: false,
  })
  reference?: string;

  @ApiProperty({
    description: 'Created date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last updated date',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Processed date',
    example: '2024-01-15T10:30:00.000Z',
    required: false,
  })
  processedAt?: Date;

  @ApiProperty({
    description: 'Requested by user ID',
    example: 'user_1234567890abcdef',
    required: false,
  })
  requestedById?: string;

  @ApiProperty({
    description: 'Approved by user ID',
    example: 'user_1234567890abcdef',
    required: false,
  })
  approvedById?: string;
}

// Refundable Amount Response DTO
export class RefundableAmountResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_1234567890abcdef',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Original payment amount',
    example: 100000,
  })
  originalAmount: number;

  @ApiProperty({
    description: 'Total amount already refunded',
    example: 25000,
  })
  refundedAmount: number;

  @ApiProperty({
    description: 'Amount available for refund',
    example: 75000,
  })
  refundableAmount: number;

  @ApiProperty({
    description: 'Currency',
    example: 'VND',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'succeeded',
  })
  paymentStatus: string;
}

// Reconcile Upload DTO (for CSV upload)
export class ReconcileUploadDto {
  @ApiProperty({
    description: 'Base64 encoded CSV file content',
    example:
      'ZGF0ZSxhbW91bnQscmVmZXJlbmNlLHR4bl9pZA0KMjAyNC0wMS0xNSw1MDAwMCxBQ1RBIFJFRiByZWZ1bmRfMTIzLFRYTjEyMzQ1Njc4OQ==',
  })
  @IsString()
  csvBase64: string;
}

// Reconciliation Result DTO
export class ReconciliationResultDto {
  @ApiProperty({
    description: 'Total rows processed',
    example: 100,
  })
  totalRows: number;

  @ApiProperty({
    description: 'Number of matched rows',
    example: 85,
  })
  matchedRows: number;

  @ApiProperty({
    description: 'Number of unmatched rows',
    example: 15,
  })
  unmatchedRowsCount: number;

  @ApiProperty({
    description: 'Number of refunds settled',
    example: 5,
  })
  refundsSettled: number;

  @ApiProperty({
    description: 'Number of payments reconciled',
    example: 80,
  })
  paymentsReconciled: number;

  @ApiProperty({
    description: 'Processing summary',
    example: 'Successfully processed 100 rows, matched 85, settled 5 refunds',
  })
  summary: string;

  @ApiProperty({
    description: 'Unmatched rows for manual review',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        row: { type: 'number' },
        date: { type: 'string' },
        amount: { type: 'number' },
        reference: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  })
  unmatchedRows: Array<{
    row: number;
    date: string;
    amount: number;
    reference: string;
    reason: string;
  }>;
}
