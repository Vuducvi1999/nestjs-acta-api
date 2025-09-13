import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsISO8601,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// Query DTOs for reporting endpoints
export class DateRangeQueryDto {
  @ApiProperty({
    description: 'Start date (inclusive) in ISO 8601 format',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsISO8601()
  start!: string;

  @ApiProperty({
    description: 'End date (inclusive) in ISO 8601 format',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsISO8601()
  end!: string;

  @ApiProperty({
    description: 'Payment provider filter',
    example: 'vietqr',
    required: false,
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    description: 'Payment method filter',
    example: 'transfer',
    required: false,
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({
    description: 'Warehouse ID filter',
    example: 'warehouse_1234567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Sale channel ID filter',
    example: 'channel_1234567890abcdef',
    required: false,
  })
  @IsOptional()
  @IsString()
  saleChannelId?: string;
}

export class PaginationQueryDto {
  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
    minimum: 1,
    maximum: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 50;

  @ApiProperty({
    description: 'Cursor for pagination (base64 encoded)',
    example:
      'eyJpZCI6InBheV8xMjM0NTY3ODkwYWJjZGVmIiwidXBkYXRlZEF0IjoiMjAyNC0wMS0xNVQxMDowMDowMC4wMDBaIn0=',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

// Response DTOs for analytics data
export class PaymentsDailyAggDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2024-01-15',
  })
  day: string;

  @ApiProperty({
    description: 'Payment provider',
    example: 'vietqr',
  })
  provider: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'transfer',
  })
  method: string;

  @ApiProperty({
    description: 'Warehouse ID',
    example: 'warehouse_1234567890abcdef',
    required: false,
  })
  warehouseId?: string;

  @ApiProperty({
    description: 'Sale channel ID',
    example: 'channel_1234567890abcdef',
    required: false,
  })
  saleChannelId?: string;

  @ApiProperty({
    description: 'Number of pending payments',
    example: 25,
  })
  pendingCount: number;

  @ApiProperty({
    description: 'Number of succeeded payments',
    example: 180,
  })
  succeededCount: number;

  @ApiProperty({
    description: 'Number of cancelled payments',
    example: 15,
  })
  cancelledCount: number;

  @ApiProperty({
    description: 'Number of failed payments',
    example: 5,
  })
  failedCount: number;

  @ApiProperty({
    description: 'Number of refunded payments',
    example: 8,
  })
  refundedCount: number;

  @ApiProperty({
    description: 'Total amount of pending payments',
    example: 1250000,
  })
  amountPending: number;

  @ApiProperty({
    description: 'Total amount of succeeded payments',
    example: 9000000,
  })
  amountSucceeded: number;

  @ApiProperty({
    description: 'Total amount of refunded payments',
    example: 400000,
  })
  amountRefunded: number;

  @ApiProperty({
    description: 'Average time to pay in seconds',
    example: 120,
  })
  avgTimeToPaySec: number;

  @ApiProperty({
    description: 'Number of payment regenerations (retries)',
    example: 3,
  })
  regenCount: number;
}

export class OrdersDailyAggDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2024-01-15',
  })
  day: string;

  @ApiProperty({
    description: 'Warehouse ID',
    example: 'warehouse_1234567890abcdef',
    required: false,
  })
  warehouseId?: string;

  @ApiProperty({
    description: 'Sale channel ID',
    example: 'channel_1234567890abcdef',
    required: false,
  })
  saleChannelId?: string;

  @ApiProperty({
    description: 'Number of orders created',
    example: 200,
  })
  ordersCreated: number;

  @ApiProperty({
    description: 'Number of orders awaiting payment',
    example: 25,
  })
  ordersPayable: number;

  @ApiProperty({
    description: 'Number of completed orders',
    example: 175,
  })
  ordersCompleted: number;

  @ApiProperty({
    description: 'Number of cancelled orders',
    example: 15,
  })
  ordersCancelled: number;

  @ApiProperty({
    description: 'Average Order Value',
    example: 50000,
  })
  aov: number;

  @ApiProperty({
    description: 'Total revenue from succeeded payments',
    example: 9000000,
  })
  revenue: number;
}

export class RefundsDailyAggDto {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2024-01-15',
  })
  day: string;

  @ApiProperty({
    description: 'Payment provider',
    example: 'vietqr',
  })
  provider: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'transfer',
  })
  method: string;

  @ApiProperty({
    description: 'Warehouse ID',
    example: 'warehouse_1234567890abcdef',
    required: false,
  })
  warehouseId?: string;

  @ApiProperty({
    description: 'Sale channel ID',
    example: 'channel_1234567890abcdef',
    required: false,
  })
  saleChannelId?: string;

  @ApiProperty({
    description: 'Number of refunds requested',
    example: 12,
  })
  refundsRequested: number;

  @ApiProperty({
    description: 'Number of refunds approved',
    example: 10,
  })
  refundsApproved: number;

  @ApiProperty({
    description: 'Number of refunds succeeded',
    example: 8,
  })
  refundsSucceeded: number;

  @ApiProperty({
    description: 'Number of refunds cancelled',
    example: 2,
  })
  refundsCancelled: number;

  @ApiProperty({
    description: 'Total amount refunded',
    example: 400000,
  })
  amountRefunded: number;
}

export class ReportsSummaryDto {
  @ApiProperty({
    description: 'Payment Success Rate (0-1)',
    example: 0.85,
  })
  paymentSuccessRate: number;

  @ApiProperty({
    description: 'QR Expiry Rate (0-1)',
    example: 0.12,
  })
  qrExpiryRate: number;

  @ApiProperty({
    description: 'Average Time To Pay in seconds',
    example: 120,
  })
  avgTimeToPaySec: number;

  @ApiProperty({
    description: 'Total revenue',
    example: 9000000,
  })
  revenue: number;

  @ApiProperty({
    description: 'Average Order Value',
    example: 50000,
  })
  aov: number;

  @ApiProperty({
    description: 'Refund Rate (0-1)',
    example: 0.04,
  })
  refundRate: number;

  @ApiProperty({
    description: 'Payment Regeneration Rate (0-1)',
    example: 0.08,
  })
  regenRate: number;

  @ApiProperty({
    description: 'Total orders created',
    example: 200,
  })
  totalOrders: number;

  @ApiProperty({
    description: 'Total payments initiated',
    example: 225,
  })
  totalPayments: number;

  @ApiProperty({
    description: 'Total refunds processed',
    example: 8,
  })
  totalRefunds: number;
}

export class PaymentDrilldownDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_1234567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Payment code',
    example: 'PAY_1705315200000_abc123',
  })
  code: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'order_1234567890abcdef',
  })
  orderId: string;

  @ApiProperty({
    description: 'Order code',
    example: 'HN-250827-023',
  })
  orderCode: string;

  @ApiProperty({
    description: 'Payment provider',
    example: 'vietqr',
  })
  provider: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'transfer',
  })
  method: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'succeeded',
  })
  status: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 50000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment currency',
    example: 'VND',
  })
  currency: string;

  @ApiProperty({
    description: 'Created date',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Succeeded date',
    example: '2024-01-15T10:02:00.000Z',
    required: false,
  })
  succeededAt?: string;

  @ApiProperty({
    description: 'Expires date',
    example: '2024-01-15T10:02:00.000Z',
    required: false,
  })
  expiresAt?: string;

  @ApiProperty({
    description: 'Time to pay in seconds',
    example: 120,
    required: false,
  })
  timeToPaySec?: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({
    description: 'Array of items',
  })
  data: T[];

  @ApiProperty({
    description: 'Next cursor for pagination',
    example:
      'eyJpZCI6InBheV8xMjM0NTY3ODkwYWJjZGVmIiwidXBkYXRlZEF0IjoiMjAyNC0wMS0xNVQxMDowMDowMC4wMDBaIn0=',
    required: false,
  })
  nextCursor?: string;

  @ApiProperty({
    description: 'Whether there are more items',
    example: true,
  })
  hasMore: boolean;

  @ApiProperty({
    description: 'Total count of items',
    example: 1000,
  })
  totalCount: number;
}
