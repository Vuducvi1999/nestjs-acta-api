import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentProcessingStatus,
  PaymentProvider,
  PaymentMethod,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
} from 'class-validator';

// Initiate Payment DTO for POST /payments/create
export class InitiatePaymentDto {
  @ApiProperty({
    description: 'ID của đơn hàng',
    example: 'order_1234567890abcdef',
  })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({
    description:
      'ID của payment (optional - backend will create if not provided)',
    example: 'pay_1234567890abcdef',
  })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiProperty({
    description: 'Phương thức thanh toán',
    enum: PaymentMethod,
    example: PaymentMethod.transfer,
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({
    description: 'Nhà cung cấp thanh toán',
    enum: PaymentProvider,
    example: PaymentProvider.vietqr,
  })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Idempotency key để tránh tạo payment trùng lặp',
    example: 'req_1234567890abcdef',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  // Internal field for user context (set by controller)
  userId?: string;
}

// Manual Verify Payment DTO for development/backoffice
export class ManualVerifyPaymentDto {
  @ApiPropertyOptional({
    description: 'Force payment to succeed (for testing)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  succeed?: boolean;

  @ApiPropertyOptional({
    description: 'Provider reference ID',
    example: 'vnp_1234567890',
  })
  @IsOptional()
  @IsString()
  providerRef?: string;

  @ApiPropertyOptional({
    description: 'Payment amount',
    example: 480000,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;
}

// VietQR Webhook DTO
export class VietQRWebhookDto {
  @ApiProperty({
    description: 'Transaction reference',
    example: 'ACTA_HN-250827-023',
  })
  @IsString()
  @IsNotEmpty()
  reference: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 480000,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Transaction currency',
    example: 'VND',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Bank transaction ID',
    example: 'vnp_1234567890',
  })
  @IsString()
  transactionId: string;

  @ApiProperty({
    description: 'Account number',
    example: '1234567890',
  })
  @IsString()
  accountNo: string;

  @ApiProperty({
    description: 'Bank code',
    example: '970436',
  })
  @IsString()
  bankCode: string;

  @ApiProperty({
    description: 'Account name',
    example: 'ACTA E-COMMERCE',
  })
  @IsString()
  accountName: string;

  @ApiProperty({
    description: 'Transaction date',
    example: '2024-01-15T12:00:00.000Z',
  })
  @IsString()
  transactionDate: string;

  @ApiPropertyOptional({
    description: 'Transaction description',
    example: 'Thanh toan don hang ACTA_HN-250827-023',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { orderCode: 'HN-250827-023' },
  })
  @IsOptional()
  meta?: any;
}

// Webhook Signature Headers DTO
export class WebhookSignatureHeadersDto {
  @ApiProperty({
    description: 'Webhook signature for verification',
    example: 'sha256=abc123...',
  })
  @IsString()
  @IsNotEmpty()
  'x-signature': string;

  @ApiProperty({
    description: 'Webhook timestamp',
    example: '1642233600',
  })
  @IsString()
  @IsNotEmpty()
  'x-timestamp': string;

  @ApiPropertyOptional({
    description: 'Webhook nonce for replay protection',
    example: 'nonce_1234567890',
  })
  @IsOptional()
  @IsString()
  'x-nonce'?: string;
}

// Payment Verification Request DTO
export class PaymentVerificationRequestDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({
    description: 'Payment provider',
    enum: PaymentProvider,
    example: PaymentProvider.vietqr,
  })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Payment amount',
    example: 480000,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Payment currency',
    example: 'VND',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Provider reference ID',
    example: 'vnp_1234567890',
  })
  @IsOptional()
  @IsString()
  providerRef?: string;

  @ApiPropertyOptional({
    description: 'Raw webhook payload',
    example: { reference: 'ACTA_HN-250827-023', amount: 480000 },
  })
  @IsOptional()
  rawPayload?: any;
}

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_123456789',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'order_123456789',
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
    enum: ['vietqr', 'stripe', 'cash'],
  })
  provider: string;

  @ApiProperty({
    description: 'Payment method',
    example: 'transfer',
    enum: ['cash', 'card', 'wallet', 'transfer', 'voucher', 'other'],
  })
  method: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'pending',
    enum: [
      'created',
      'pending',
      'succeeded',
      'failed',
      'cancelled',
      'refunded',
    ],
  })
  status: PaymentProcessingStatus;

  @ApiProperty({
    description: 'Payment amount',
    example: 100000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment currency',
    example: 'VND',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment expiration time',
    example: '2024-01-01T12:02:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'QR content for payment (URL or EMV data)',
    example:
      'https://img.vietqr.io/image/970436-1234567890-qr_only.png?amount=100000&addInfo=ACTA%20HN-250827-023&accountName=ACTA%20E-COMMERCE',
  })
  qrContent: string;

  @ApiPropertyOptional({
    description: 'QR image as data URL (if available)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  qrImageDataUrl?: string;

  @ApiProperty({
    description: 'URL for polling payment status',
    example: '/payments/pay_123456789/status',
  })
  pollingUrl: string;

  @ApiProperty({
    description: 'Payment message',
    example:
      'Payment initiated successfully. Please scan QR code to complete payment within 2 minutes.',
  })
  message: string;
}

export class PaymentCompletionResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_123456789',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'ord_123456789',
  })
  orderId: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'succeeded',
    enum: [
      'created',
      'pending',
      'succeeded',
      'failed',
      'cancelled',
      'refunded',
    ],
  })
  status: PaymentProcessingStatus;

  @ApiProperty({
    description: 'Completion message',
    example: 'Payment completed successfully',
  })
  message: string;
}

export class PaymentStatusResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: 'pay_123456789',
  })
  paymentId: string;

  @ApiProperty({
    description: 'Order ID',
    example: 'order_123456789',
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
    enum: ['vnpay', 'stripe', 'vietqr'],
  })
  provider: PaymentProvider;

  @ApiProperty({
    description: 'Payment status',
    example: 'pending',
    enum: [
      'created',
      'pending',
      'succeeded',
      'failed',
      'cancelled',
      'refunded',
    ],
  })
  status: PaymentProcessingStatus;

  @ApiProperty({
    description: 'Payment amount',
    example: 100000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment currency',
    example: 'VND',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Payment expiration time (only when status is pending)',
    example: '2024-01-01T12:02:00.000Z',
  })
  expiresAt?: Date;

  @ApiProperty({
    description: 'Status message',
    example: 'Payment pending - please complete within 2 minutes',
  })
  message: string;
}
