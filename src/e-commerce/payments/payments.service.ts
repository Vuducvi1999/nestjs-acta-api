import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  PaymentProcessingStatus,
  PaymentStatus,
  PaymentProvider,
  PaymentMethod,
  TransactionType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CashProvider,
  CashPaymentRequest,
  CashPaymentResponse,
} from './providers/cash.provider';
import {
  PaymentRequest,
  PaymentResponse,
  PaymentCompletionResponse,
  PaymentWithOrderPayment,
  PendingPayment,
} from './types/payment.types';
import {
  InitiatePaymentDto,
  PaymentResponseDto,
  PaymentStatusResponseDto,
  PaymentVerificationRequestDto,
  VietQRWebhookDto,
} from './dto/payment-response.dto';
import { PaymentEventsService } from './payment-events.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // VietQR configuration - should come from environment variables
  private readonly BANK_BIN = process.env.VIETQR_BANK_BIN || '970407'; // Example: Vietcombank
  private readonly ACCOUNT_NUMBER =
    process.env.VIETQR_ACCOUNT_NUMBER || '19028269053022';
  private readonly ACCOUNT_NAME =
    process.env.VIETQR_ACCOUNT_NAME || 'NGUYEN MINH TRI';
  private readonly QR_EXPIRES_MINUTES = process.env.VIETQR_EXPIRES_MINUTES
    ? parseInt(process.env.VIETQR_EXPIRES_MINUTES)
    : 15; // Default 15 minutes for real-world scenarios

  constructor(
    private readonly prisma: PrismaService,
    private readonly cashProvider: CashProvider,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  /**
   * Create payment based on provider - Step 2: Initiate Payment
   */
  async createPayment(
    request: InitiatePaymentDto,
  ): Promise<PaymentResponseDto> {
    const { orderId, paymentId, method, provider, idempotencyKey } = request;

    try {
      this.logger.log(
        `Creating payment for order ${orderId} with provider ${provider}`,
      );

      // Validate method/provider combination
      if (method === 'transfer' && provider !== 'vietqr') {
        throw new BadRequestException(
          'Phương thức chuyển khoản chỉ hỗ trợ VietQR',
        );
      }

      // Check idempotency if key is provided
      if (idempotencyKey) {
        const existingPayment = await this.prisma.payment.findFirst({
          where: {
            idempotencyKey,
            orderPayment: {
              orderId: orderId,
            },
          },
          include: {
            orderPayment: {
              include: {
                order: true,
              },
            },
          },
        });

        if (existingPayment) {
          this.logger.log(
            `Returning existing payment for idempotency key: ${idempotencyKey}`,
          );
          return this.mapPaymentToResponseDto(existingPayment);
        }
      }

      // Find the OrderPayment record for this order
      const orderPayment = await this.prisma.orderPayment.findFirst({
        where: {
          orderId: orderId,
        },
        include: {
          order: {
            include: {
              customer: true,
            },
          },
        },
      });

      if (!orderPayment) {
        throw new BadRequestException('Order payment not found');
      }

      // Check if order is payable
      if (
        orderPayment.order.status !== 'draft' &&
        orderPayment.order.status !== 'confirmed'
      ) {
        throw new BadRequestException('Order is not in a payable state');
      }

      // Check if a Payment record already exists for this OrderPayment
      let payment = await this.prisma.payment.findFirst({
        where: {
          orderPaymentId: orderPayment.id,
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      // If no Payment record exists, create one
      if (!payment) {
        payment = await this.prisma.payment.create({
          data: {
            code: `PAY-${orderPayment.order.code}-${Date.now()}`,
            provider: provider,
            method: method,
            amount: orderPayment.amount,
            currency: 'VND',
            status: 'created',
            expiresAt:
              orderPayment.expiresAt || new Date(Date.now() + 15 * 60 * 1000), // 15 minutes default
            orderPaymentId: orderPayment.id,
            idempotencyKey: idempotencyKey,
          },
          include: {
            orderPayment: {
              include: {
                order: true,
              },
            },
          },
        });
      }

      // Cross-check/overwrite amount from orderPayment.amount (never trust client)
      const orderTotal = Number(orderPayment.amount || 0);
      if (orderTotal <= 0) {
        throw new BadRequestException('Order total is invalid');
      }

      // Route to appropriate provider
      switch (provider) {
        case PaymentProvider.vietqr:
          return await this.handleVietQRPayment(request, orderTotal);
        case PaymentProvider.stripe:
          return await this.handleStripePayment(request, orderTotal);
        default:
          // For cash payments or other methods, use cash provider
          return await this.handleCashPayment(request, orderTotal);
      }
    } catch (error) {
      this.logger.error(`Payment creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle VietQR webhook from bank
   */
  async handleVietQRWebhook(
    webhookData: VietQRWebhookDto,
  ): Promise<PaymentCompletionResponse> {
    try {
      this.logger.log(
        `Processing VietQR webhook: ${JSON.stringify(webhookData)}`,
      );

      // Parse reference to get order code and payment ID
      const referenceInfo = this.parseVietQRReference(webhookData.reference);

      if (!referenceInfo.orderCode) {
        throw new BadRequestException('Invalid reference format in webhook');
      }

      // Find payment by order code
      const payment = await this.prisma.payment.findFirst({
        where: {
          orderPayment: {
            order: {
              code: referenceInfo.orderCode,
            },
          },
          provider: 'vietqr',
          status: PaymentProcessingStatus.pending,
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        throw new BadRequestException(
          `Payment not found for order ${referenceInfo.orderCode}`,
        );
      }

      // Verify amount matches
      if (webhookData.amount !== Number(payment.amount)) {
        this.logger.warn(
          `Amount mismatch: expected ${payment.amount}, got ${webhookData.amount}`,
        );
        throw new BadRequestException(
          'Payment amount does not match order total',
        );
      }

      // Emit webhook received event via WebSocket
      if (payment.orderPayment?.orderId) {
        this.paymentEvents.emitWebhookReceived(
          payment.id,
          payment.orderPayment.orderId,
          webhookData,
        );
      }

      // Process payment completion
      if (!payment.orderPayment) {
        throw new BadRequestException(
          'Payment is not associated with an order',
        );
      }

      const result = await this.completePaymentTransaction(
        payment.id,
        payment.orderPayment.orderId,
        webhookData.transactionId,
        webhookData,
      );

      // Emit webhook processed event via WebSocket
      if (payment.orderPayment?.orderId) {
        this.paymentEvents.emitWebhookProcessed(
          payment.id,
          payment.orderPayment.orderId,
          result,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`VietQR webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse VietQR reference to extract order code
   */
  private parseVietQRReference(reference: string): {
    orderCode?: string;
    paymentId?: string;
  } {
    // Expected format: "ACTA {orderCode}" or "ACTA {orderCode} | pay:{paymentId}"
    if (reference.startsWith('ACTA ')) {
      const parts = reference.split(' | pay:');
      const orderCode = parts[0].replace('ACTA ', '');
      const paymentId = parts[1];

      return {
        orderCode,
        paymentId,
      };
    }

    return {};
  }

  /**
   * Verify payment - Step 3: Verify & Complete
   */
  async verifyPayment(
    request: PaymentVerificationRequestDto,
  ): Promise<PaymentCompletionResponse> {
    const { paymentId, provider, amount, currency, providerRef, rawPayload } =
      request;

    try {
      this.logger.log(
        `Verifying payment ${paymentId} with provider ${provider}`,
      );

      // Load Payment with orderPayment.order
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          orderPayment: {
            isNot: null,
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      const order = payment.orderPayment?.order;
      if (!order) {
        throw new BadRequestException('Order not found for payment');
      }

      // If status is already succeeded, return success (idempotent)
      if (payment.status === PaymentProcessingStatus.succeeded) {
        this.logger.log(
          `Payment ${paymentId} already succeeded, returning success`,
        );
        return {
          success: true,
          paymentId,
          orderId: order.id,
          status: PaymentProcessingStatus.succeeded,
          message: 'Payment already completed successfully',
        };
      }

      // If status is not pending, reject
      if (payment.status !== PaymentProcessingStatus.pending) {
        throw new BadRequestException(
          `Payment is not in pending state. Current status: ${payment.status}`,
        );
      }

      // Check if payment has expired
      if (payment.expiresAt && new Date() > payment.expiresAt) {
        this.logger.warn(`Payment ${paymentId} has expired, marking as failed`);

        // Mark as failed and restore inventory
        await this.handlePaymentExpiration(paymentId, order.id);

        return {
          success: false,
          paymentId,
          orderId: order.id,
          status: PaymentProcessingStatus.failed,
          message: 'Payment has expired',
        };
      }

      // Validate amount and currency
      const orderTotal = Number(payment.orderPayment?.amount || 0);
      if (amount && amount !== orderTotal) {
        this.logger.warn(
          `Amount mismatch: expected ${orderTotal}, got ${amount}`,
        );
        throw new BadRequestException(
          'Payment amount does not match order total',
        );
      }

      if (currency && currency !== 'VND') {
        throw new BadRequestException('Payment currency must be VND');
      }

      // Process payment completion in a single transaction
      return await this.completePaymentTransaction(
        paymentId,
        order.id,
        providerRef,
        rawPayload,
      );
    } catch (error) {
      this.logger.error(`Payment verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete payment transaction in a single database transaction
   */
  private async completePaymentTransaction(
    paymentId: string,
    orderId: string,
    providerRef?: string,
    rawPayload?: any,
  ): Promise<PaymentCompletionResponse> {
    return await this.prisma.$transaction(async (tx) => {
      // Update Payment
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.succeeded,
          succeededAt: new Date(),
          providerRef,
          responseMeta: {
            rawPayload,
            verifiedAt: new Date().toISOString(),
            verificationMethod: 'webhook',
          },
        },
      });

      // Update Order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'completed',
          paidAt: new Date(),
          completedAt: new Date(),
        },
      });

      // Update OrderPayment
      await tx.orderPayment.updateMany({
        where: {
          orderId: orderId,
          payment: {
            id: paymentId,
          },
        },
        data: {
          status: PaymentStatus.paid,
        },
      });

      // Commit inventory
      const { CheckoutHelper } = await import('../checkout/checkout.helper');
      await CheckoutHelper.commitInventoryOnPaymentSuccess(orderId, tx);

      this.logger.log(
        `Payment ${paymentId} completed successfully for order ${orderId}`,
      );

      // Emit payment success event via WebSocket
      this.paymentEvents.emitPaymentSuccess(
        paymentId,
        orderId,
        Number(updatedPayment.amount),
      );

      return {
        success: true,
        paymentId,
        orderId,
        status: PaymentProcessingStatus.succeeded,
        message: 'Payment completed successfully',
      };
    });
  }

  /**
   * Handle payment expiration
   */
  private async handlePaymentExpiration(
    paymentId: string,
    orderId: string,
  ): Promise<void> {
    try {
      // Update payment status to failed
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.failed,
          failedAt: new Date(),
          responseMeta: {
            expiredAt: new Date().toISOString(),
            reason: 'payment_timeout',
          },
        },
      });

      // Update order payment status
      await this.prisma.orderPayment.updateMany({
        where: {
          orderId: orderId,
          payment: {
            id: paymentId,
          },
        },
        data: {
          status: PaymentStatus.failed,
        },
      });

      // Update order status to cancelled
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      // Restore product inventory
      const { CheckoutHelper } = await import('../checkout/checkout.helper');
      await this.prisma.$transaction(async (tx) => {
        await CheckoutHelper.restoreInventoryOnPaymentFailure(orderId, tx);
      });

      // Emit payment failure event via WebSocket
      this.paymentEvents.emitPaymentFailure(
        paymentId,
        orderId,
        'Payment expired',
      );

      this.logger.log(
        `Payment ${paymentId} expired and inventory restored for order ${orderId}`,
      );
    } catch (error) {
      this.logger.error(`Error handling payment expiration: ${error.message}`);
    }
  }

  /**
   * Handle VietQR payment
   */
  private async handleVietQRPayment(
    request: InitiatePaymentDto,
    orderTotal: number,
  ): Promise<PaymentResponseDto> {
    const { orderId, paymentId, idempotencyKey } = request;

    // Check for existing pending VietQR payment (idempotency)
    const existingPendingPayment = await this.prisma.payment.findFirst({
      where: {
        orderPayment: {
          orderId: orderId,
        },
        provider: 'vietqr',
        status: PaymentProcessingStatus.pending,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      include: {
        orderPayment: {
          include: {
            order: true,
          },
        },
      },
    });

    if (existingPendingPayment) {
      this.logger.log(
        `Returning existing pending VietQR payment for order ${orderId}`,
      );
      return this.mapPaymentToResponseDto(existingPendingPayment);
    }

    // Check for expired pending payment (race condition handling)
    const expiredPendingPayment = await this.prisma.payment.findFirst({
      where: {
        orderPayment: {
          orderId: orderId,
        },
        provider: 'vietqr',
        status: PaymentProcessingStatus.pending,
        expiresAt: {
          lt: new Date(), // Expired
        },
      },
    });

    if (expiredPendingPayment) {
      this.logger.log(
        `Found expired pending payment ${expiredPendingPayment.id} for order ${orderId}, cancelling it first`,
      );

      // Cancel the expired payment
      await this.prisma.payment.update({
        where: { id: expiredPendingPayment.id },
        data: {
          status: PaymentProcessingStatus.cancelled,
          cancelledAt: new Date(),
          responseMeta: {
            ...((expiredPendingPayment.responseMeta as any) || {}),
            cancelledByRetry: true,
            cancelledAt: new Date().toISOString(),
            reason: 'expired_pending_replaced_by_retry',
          },
        },
      });

      // Update order payment status
      await this.prisma.orderPayment.updateMany({
        where: {
          orderId: orderId,
          payment: {
            id: expiredPendingPayment.id,
          },
        },
        data: {
          status: PaymentStatus.canceled,
        },
      });

      // Restore inventory for the expired payment
      const { CheckoutHelper } = await import('../checkout/checkout.helper');
      await this.prisma.$transaction(async (tx) => {
        await CheckoutHelper.restoreInventoryOnPaymentFailure(orderId, tx);
      });
    }

    // Check for cancelled/expired payments to support retry
    const lastCancelledPayment = await this.prisma.payment.findFirst({
      where: {
        orderPayment: {
          orderId: orderId,
        },
        provider: 'vietqr',
        status: {
          in: [
            PaymentProcessingStatus.cancelled,
            PaymentProcessingStatus.failed,
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (lastCancelledPayment) {
      this.logger.log(
        `Found previous cancelled/failed payment ${lastCancelledPayment.id} for order ${orderId}, allowing retry`,
      );
    }

    // Find existing payment or create new one
    let payment = await this.prisma.payment.findFirst({
      where: {
        orderPayment: {
          orderId: orderId,
        },
        provider: 'vietqr',
        status: PaymentProcessingStatus.created,
      },
      include: {
        orderPayment: {
          include: {
            order: true,
          },
        },
      },
    });

    // If no payment exists, create one
    if (!payment) {
      this.logger.log(
        `No existing payment found for order ${orderId}, creating new one`,
      );

      // Find the OrderPayment record
      const orderPayment = await this.prisma.orderPayment.findFirst({
        where: {
          orderId: orderId,
        },
        include: {
          order: true,
        },
      });

      if (!orderPayment) {
        throw new BadRequestException(
          'OrderPayment not found for order. Please ensure the order was created successfully.',
        );
      }

      // Create a new payment
      payment = await this.prisma.payment.create({
        data: {
          code: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          provider: 'vietqr',
          method: 'transfer',
          amount: orderTotal,
          currency: 'VND',
          status: PaymentProcessingStatus.created,
          orderPaymentId: orderPayment.id,
          requestMeta: {
            createdForNewOrder: true,
            createdAt: new Date().toISOString(),
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      this.logger.log(`Created new payment ${payment.id} for order ${orderId}`);
    }

    if (!payment) {
      throw new BadRequestException(
        'Payment not found or not in valid state for processing',
      );
    }

    // Compute expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.QR_EXPIRES_MINUTES);

    // Generate VietQR content
    const qrContent = this.generateVietQRContent(
      orderTotal,
      payment.orderPayment?.order?.code || orderId,
    );

    // Update payment status to pending
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentProcessingStatus.pending,
        expiresAt,
        requestMeta: {
          ...((payment.requestMeta as any) || {}),
          amount: orderTotal,
          description: `Thanh toan don hang ${payment.orderPayment?.order?.code || orderId}`,
          orderCode: payment.orderPayment?.order?.code,
          bankBin: this.BANK_BIN,
          accountNumber: this.ACCOUNT_NUMBER,
          accountName: this.ACCOUNT_NAME,
          updatedAt: new Date().toISOString(),
        },
        responseMeta: {
          qrContent,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // Update payment with idempotency key if provided
    if (idempotencyKey) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { idempotencyKey },
      });
    }

    // Emit payment created event via WebSocket
    this.paymentEvents.emitPaymentStatusUpdate(
      payment.id,
      orderId,
      PaymentProcessingStatus.pending,
      `VietQR payment created successfully. Please scan QR code to complete payment within ${this.QR_EXPIRES_MINUTES} minutes.`,
      expiresAt,
    );

    return {
      success: true,
      paymentId: payment.id,
      orderId,
      orderCode: payment.orderPayment?.order?.code || '',
      provider: 'vietqr',
      method: 'transfer',
      status: PaymentProcessingStatus.pending,
      amount: orderTotal,
      currency: 'VND',
      expiresAt,
      qrContent,
      qrImageDataUrl: undefined, // Will be generated by frontend if needed
      pollingUrl: `/payments/${payment.id}/status`,
      message: `VietQR payment created successfully. Please scan QR code to complete payment within ${this.QR_EXPIRES_MINUTES} minutes.`,
    };
  }

  /**
   * Generate VietQR content (URL)
   */
  private generateVietQRContent(amount: number, orderCode: string): string {
    // VietQR format: https://img.vietqr.io/image/{bankCode}-{accountNo}-qr_only.png?amount={amount}&addInfo={description}&accountName={accountName}
    const addInfo = encodeURIComponent(`ACTA ${orderCode}`);
    const accountName = encodeURIComponent(this.ACCOUNT_NAME);

    return `https://img.vietqr.io/image/${this.BANK_BIN}-${this.ACCOUNT_NUMBER}-qr_only.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
  }

  /**
   * Simulate bank verification (replace with real bank API call)
   */
  private async simulateBankVerification(paymentId: string): Promise<boolean> {
    // In a real implementation, you would call the bank's API to verify payment
    // For now, we'll simulate verification with a random success rate
    // In production, this should be replaced with actual bank API integration

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // For demo purposes, return true 80% of the time
    return Math.random() > 0.2;
  }

  /**
   * Handle Stripe payment (placeholder for future implementation)
   */
  private async handleStripePayment(
    request: InitiatePaymentDto,
    orderTotal: number,
  ): Promise<PaymentResponseDto> {
    throw new BadRequestException('Stripe payment not implemented yet');
  }

  /**
   * Handle cash payment
   */
  private async handleCashPayment(
    request: InitiatePaymentDto,
    orderTotal: number,
  ): Promise<PaymentResponseDto> {
    const { orderId, paymentId } = request;

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderPayment: {
          orderId: orderId,
        },
      },
      include: {
        orderPayment: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    // For cash payments, we might handle differently
    // For now, return a basic response
    return {
      success: true,
      paymentId: payment.id,
      orderId: payment.orderPayment?.order?.id || '',
      orderCode: payment.orderPayment?.order?.code || '',
      provider: 'cash',
      method: 'cash',
      status: PaymentProcessingStatus.pending,
      amount: orderTotal,
      currency: 'VND',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for cash
      qrContent: '',
      pollingUrl: `/payments/${paymentId}/status`,
      message:
        'Cash payment initiated. Please complete payment at pickup location.',
    };
  }

  /**
   * Get payment status for polling
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        orderPayment: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const order = payment.orderPayment?.order;
    if (!order) {
      throw new BadRequestException('Order not found for payment');
    }

    let message = '';
    switch (payment.status) {
      case PaymentProcessingStatus.created:
        message = 'Payment created';
        break;
      case PaymentProcessingStatus.pending:
        if (payment.expiresAt && new Date() > payment.expiresAt) {
          message = 'Payment expired';
        } else {
          message = 'Payment pending - please complete payment';
        }
        break;
      case PaymentProcessingStatus.succeeded:
        message = 'Payment completed successfully';
        break;
      case PaymentProcessingStatus.failed:
        message = 'Payment failed - please try again';
        break;
      case PaymentProcessingStatus.cancelled:
        message = 'Payment cancelled';
        break;
      case PaymentProcessingStatus.refunded:
        message = 'Payment refunded';
        break;
      default:
        message = 'Unknown status';
    }

    return {
      paymentId: payment.id,
      orderId: order.id,
      orderCode: order.code,
      provider: payment.provider,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      expiresAt:
        payment.status === PaymentProcessingStatus.pending
          ? payment.expiresAt || undefined
          : undefined,
      message,
    };
  }

  /**
   * Map payment to response DTO
   */
  private mapPaymentToResponseDto(payment: any): PaymentResponseDto {
    const order = payment.orderPayment?.order;

    return {
      success: true,
      paymentId: payment.id,
      orderId: order?.id || '',
      orderCode: order?.code || '',
      provider: payment.provider,
      method: payment.orderPayment?.method || 'transfer',
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      expiresAt: payment.expiresAt || new Date(),
      qrContent: payment.responseMeta?.qrContent || '',
      qrImageDataUrl: payment.responseMeta?.qrImageDataUrl,
      pollingUrl: `/payments/${payment.id}/status`,
      message: 'Payment retrieved successfully',
    };
  }

  /**
   * Legacy method for backward compatibility
   */
  async createPaymentLegacy(request: PaymentRequest): Promise<PaymentResponse> {
    const { orderId, paymentId, amount, provider, method, description } =
      request;

    try {
      this.logger.log(
        `Creating payment for order ${orderId} with provider ${provider}`,
      );

      // Verify payment exists and is in valid state
      const payment = (await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          orderPayment: {
            orderId: orderId,
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      })) as PaymentWithOrderPayment | null;

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      if (payment.status !== PaymentProcessingStatus.created) {
        throw new BadRequestException(
          'Payment is not in valid state for processing',
        );
      }

      // Route to appropriate provider
      switch (provider) {
        case PaymentProvider.vietqr:
          return await this.handleVietQRPaymentLegacy(request);
        case PaymentProvider.stripe:
          return await this.handleStripePaymentLegacy(request);
        default:
          // For cash payments or other methods, use cash provider
          return await this.handleCashPaymentLegacy(request);
      }
    } catch (error) {
      this.logger.error(`Payment creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Legacy VietQR payment handler - now integrated into main service
   */
  private async handleVietQRPaymentLegacy(
    request: PaymentRequest,
  ): Promise<PaymentResponse> {
    const { orderId, paymentId, amount, description } = request;

    // Use the integrated VietQR functionality
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        orderPayment: {
          orderId: orderId,
        },
      },
      include: {
        orderPayment: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    // Generate VietQR content
    const qrContent = this.generateVietQRContent(
      amount,
      payment.orderPayment?.order?.code || orderId,
    );

    // Compute expiration time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.QR_EXPIRES_MINUTES);

    return {
      success: true,
      paymentId: payment.id,
      provider: 'vietqr',
      method: 'transfer',
      status: PaymentProcessingStatus.pending,
      amount: amount,
      message: `VietQR payment created successfully. Please scan QR code to complete payment within ${this.QR_EXPIRES_MINUTES} minutes.`,
      qrCode: undefined, // Will be generated by frontend if needed
      qrData: qrContent,
      expiresAt,
    };
  }

  /**
   * Legacy Stripe payment handler
   */
  private async handleStripePaymentLegacy(
    request: PaymentRequest,
  ): Promise<PaymentResponse> {
    throw new BadRequestException('Stripe payment not implemented yet');
  }

  /**
   * Legacy cash payment handler
   */
  private async handleCashPaymentLegacy(
    request: PaymentRequest,
  ): Promise<PaymentResponse> {
    const { orderId, paymentId, amount, description } = request;

    const cashRequest: CashPaymentRequest = {
      orderId,
      paymentId,
      amount,
      description,
    };

    const cashResponse = await this.cashProvider.createPayment(cashRequest);

    return {
      success: true,
      paymentId: cashResponse.paymentId,
      provider: 'cash',
      method: 'cash',
      status: PaymentProcessingStatus.pending,
      amount: cashResponse.amount,
      message: cashResponse.message,
    };
  }

  /**
   * Legacy verify payment method
   */
  async verifyPaymentLegacy(
    paymentId: string,
  ): Promise<PaymentCompletionResponse> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Route to appropriate provider for verification
      switch (payment.provider) {
        case PaymentProvider.vietqr:
          // Use integrated verification logic
          if (!payment.orderPayment) {
            throw new BadRequestException(
              'Payment is not associated with an order',
            );
          }

          // For VietQR, we'll use the integrated verification
          // In a real scenario, this would call the bank's API
          const isVerified = await this.simulateBankVerification(paymentId);

          if (isVerified) {
            // Create verification request
            const verificationRequest: PaymentVerificationRequestDto = {
              paymentId,
              provider: 'vietqr',
              amount: Number(payment.amount),
              currency: payment.currency,
              providerRef: `legacy_verify_${Date.now()}`,
              rawPayload: {
                verificationMethod: 'legacy_verification',
                verifiedAt: new Date().toISOString(),
              },
            };

            return await this.verifyPayment(verificationRequest);
          }

          return {
            success: false,
            paymentId: payment.id,
            orderId: payment.orderPayment.orderId,
            status: payment.status,
            message: 'Payment verification pending',
          };
        default:
          throw new BadRequestException(
            `Verification not supported for provider: ${payment.provider}`,
          );
      }
    } catch (error) {
      this.logger.error(`Payment verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete payment
   */
  async completePayment(
    paymentId: string,
    orderId: string,
  ): Promise<PaymentCompletionResponse> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          orderPayment: {
            orderId: orderId,
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Update payment status to succeeded
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.succeeded,
          succeededAt: new Date(),
        },
      });

      // Update order payment status
      await this.prisma.orderPayment.updateMany({
        where: {
          orderId: orderId,
          payment: {
            id: paymentId,
          },
        },
        data: {
          status: PaymentStatus.paid,
        },
      });

      // Update order status to confirmed
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'confirmed' },
      });

      return {
        success: true,
        paymentId,
        orderId,
        status: PaymentProcessingStatus.succeeded,
        message: 'Payment completed successfully',
      };
    } catch (error) {
      this.logger.error(`Payment completion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentId: string,
    orderId: string,
  ): Promise<PaymentCompletionResponse> {
    try {
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: paymentId,
          orderPayment: {
            orderId: orderId,
          },
        },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Update payment status to cancelled
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.cancelled,
          cancelledAt: new Date(),
        },
      });

      // Update order payment status
      await this.prisma.orderPayment.updateMany({
        where: {
          orderId: orderId,
          payment: {
            id: paymentId,
          },
        },
        data: {
          status: PaymentStatus.canceled,
        },
      });

      // Update order status to cancelled
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' },
      });

      return {
        success: true,
        paymentId,
        orderId,
        status: PaymentProcessingStatus.cancelled,
        message: 'Payment cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Payment cancellation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete payment by order id (find the latest pending/created payment and mark as succeeded)
   */
  async completeByOrderId(orderId: string): Promise<CompleteByOrderResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
        } as any,
      },
    } as any);

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    // Find a payment in created or pending state
    const orderPayment = await this.prisma.orderPayment.findFirst({
      where: {
        orderId,
        payment: {
          status: {
            in: [
              PaymentProcessingStatus.created,
              PaymentProcessingStatus.pending,
            ],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { payment: true },
    });

    if (!orderPayment || !orderPayment.payment) {
      // If no pending/created payment, try to fetch last succeeded
      const lastSucceeded = await this.prisma.orderPayment.findFirst({
        where: {
          orderId,
          payment: { status: PaymentProcessingStatus.succeeded },
        },
        orderBy: { createdAt: 'desc' },
        include: { payment: true },
      });

      if (lastSucceeded?.payment) {
        return {
          success: true,
          orderId,
          paymentId: lastSucceeded.payment.id,
          status: PaymentProcessingStatus.succeeded,
          message: 'Payment already completed for this order',
        };
      }

      throw new BadRequestException('No payable payment found for order');
    }

    // Use existing transaction helper to mark succeeded and complete order
    const result = await this['completePaymentTransaction'](
      orderPayment.payment.id,
      orderId,
    );

    return {
      success: result.success,
      orderId,
      paymentId: orderPayment.payment.id,
      status: result.status,
      message: result.message,
    };
  }

  /**
   * Complete payment by order code with webhook data validation
   */
  async completeByOrderCode(
    orderCode: string,
    webhookData: any,
  ): Promise<CompleteByOrderResult> {
    const order = await this.prisma.order.findUnique({
      where: { code: orderCode },
      include: {
        payments: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
        } as any,
      },
    } as any);

    if (!order) {
      throw new BadRequestException(`Order with code ${orderCode} not found`);
    }

    // Find a payment in created or pending state
    const orderPayment = await this.prisma.orderPayment.findFirst({
      where: {
        orderId: order.id,
        payment: {
          status: {
            in: [
              PaymentProcessingStatus.created,
              PaymentProcessingStatus.pending,
            ],
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { payment: true },
    });

    if (!orderPayment || !orderPayment.payment) {
      // If no pending/created payment, try to fetch last succeeded
      const lastSucceeded = await this.prisma.orderPayment.findFirst({
        where: {
          orderId: order.id,
          payment: { status: PaymentProcessingStatus.succeeded },
        },
        orderBy: { createdAt: 'desc' },
        include: { payment: true },
      });

      if (lastSucceeded?.payment) {
        return {
          success: true,
          orderId: order.id,
          paymentId: lastSucceeded.payment.id,
          status: PaymentProcessingStatus.succeeded,
          message: 'Payment already completed for this order',
        };
      }

      throw new BadRequestException('No payable payment found for order');
    }

    // Validate transfer amount matches payment amount
    const expectedAmount = parseFloat(orderPayment.amount.toString());
    const transferAmount = webhookData.transferAmount;

    if (Math.abs(expectedAmount - transferAmount) > 0.01) {
      // Allow small floating point differences
      this.logger.warn(
        `Transfer amount mismatch. Expected: ${expectedAmount}, Received: ${transferAmount} for order ${orderCode}`,
      );
      throw new BadRequestException(
        `Transfer amount ${transferAmount} does not match expected amount ${expectedAmount}`,
      );
    }

    // Create PaymentTransaction record to track this webhook transaction
    await this.prisma.paymentTransaction.create({
      data: {
        paymentId: orderPayment.payment.id,
        type: TransactionType.charge,
        amount: new Prisma.Decimal(transferAmount),
        currency: 'VND',
        providerRef: webhookData.id.toString(), // SePay transaction ID
        meta: {
          webhook: webhookData,
          gateway: webhookData.gateway,
          transactionDate: webhookData.transactionDate,
          accountNumber: webhookData.accountNumber,
          referenceCode: webhookData.referenceCode,
        },
      },
    });

    // Use existing transaction helper to mark succeeded and complete order
    const result = await this['completePaymentTransaction'](
      orderPayment.payment.id,
      order.id,
    );

    return {
      success: result.success,
      orderId: order.id,
      paymentId: orderPayment.payment.id,
      status: result.status,
      message: result.message,
    };
  }
}

/**
 * Extension: helper to complete by order id (for external apps)
 */
export interface CompleteByOrderResult {
  success: boolean;
  orderId: string;
  paymentId: string;
  status: PaymentProcessingStatus;
  message?: string;
}
