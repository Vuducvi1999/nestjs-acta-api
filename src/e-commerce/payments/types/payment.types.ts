import { Prisma, PaymentProcessingStatus } from '@prisma/client';

// Payment with order payment type
export interface PaymentWithOrderPayment {
  id: string;
  provider: string;
  status: PaymentProcessingStatus;
  amount: Prisma.Decimal;
  createdAt: Date;
  orderPayment?: {
    id: string;
    orderId: string;
    method: string;
    status: string;
    amount: Prisma.Decimal;
    order?: {
      id: string;
      status: string;
      warehouseId: string;
    };
  } | null;
}

// Payment verification result type
export interface PaymentVerificationResult {
  success: boolean;
  paymentId: string;
  status: PaymentProcessingStatus;
  message: string;
}

// Payment completion result type
export interface PaymentCompletionResult {
  success: boolean;
  paymentId: string;
  status: PaymentProcessingStatus;
  message: string;
}

// Payment status result type
export interface PaymentStatusResult {
  status: PaymentProcessingStatus;
  message: string;
  expiresAt?: Date;
}

// Payment request type
export interface PaymentRequest {
  orderId: string;
  paymentId: string;
  amount: number;
  provider: string;
  method: string;
  description?: string;
}

// Extended payment request type with user context
export interface PaymentRequestWithUser extends PaymentRequest {
  userId: string;
}

// Payment response type
export interface PaymentResponse {
  success: boolean;
  paymentId: string;
  provider: string;
  method: string;
  status: PaymentProcessingStatus;
  amount: number;
  message: string;
  qrCode?: string;
  qrData?: string;
  redirectUrl?: string;
  expiresAt?: Date;
}

// Payment completion response type
export interface PaymentCompletionResponse {
  success: boolean;
  paymentId: string;
  orderId: string;
  status: PaymentProcessingStatus;
  message: string;
}

// Pending payment type
export interface PendingPayment {
  id: string;
  orderId: string;
  provider: string;
  createdAt: Date;
  amount: number;
}
