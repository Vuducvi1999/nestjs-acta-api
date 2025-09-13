import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PaymentProcessingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../../common/services/prisma.service';
import {
  PaymentWithOrderPayment,
  PaymentCompletionResult,
  PaymentStatusResult,
} from '../types/payment.types';

export interface CashPaymentRequest {
  orderId: string;
  paymentId: string;
  amount: number;
  description?: string;
}

export interface CashPaymentResponse {
  success: boolean;
  paymentId: string;
  amount: number;
  description: string;
  message: string;
  status: PaymentProcessingStatus;
}

export interface CashPaymentCompletion {
  success: boolean;
  paymentId: string;
  status: PaymentProcessingStatus;
  message: string;
}

@Injectable()
export class CashProvider {
  private readonly logger = new Logger(CashProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create cash payment (COD - Cash on Delivery)
   */
  async createPayment(
    request: CashPaymentRequest,
  ): Promise<CashPaymentResponse> {
    const { orderId, paymentId, amount, description } = request;

    try {
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

      // For cash payments, we immediately mark as pending since it's COD
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.pending,
          requestMeta: {
            amount,
            description:
              description || `Thanh toan tien mat don hang ${orderId}`,
            paymentType: 'cod',
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Update order payment status to processing (will be paid when delivered)
      await this.prisma.orderPayment.updateMany({
        where: {
          orderId: orderId,
          payment: {
            id: paymentId,
          },
        },
        data: {
          status: PaymentStatus.processing,
        },
      });

      // Update order status to confirmed (ready for delivery)
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'confirmed',
          usingCod: true,
        },
      });

      this.logger.log(
        `Cash payment (COD) created for order ${orderId}, payment ${paymentId}`,
      );

      return {
        success: true,
        paymentId,
        amount,
        description: description || `Thanh toan tien mat don hang ${orderId}`,
        message:
          'Cash payment (COD) created successfully. Payment will be collected upon delivery.',
        status: PaymentProcessingStatus.pending,
      };
    } catch (error) {
      this.logger.error(`Cash payment creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete cash payment (called when delivery is completed and payment is collected)
   */
  async completePayment(
    paymentId: string,
    orderId: string,
  ): Promise<PaymentCompletionResult> {
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

      if (payment.status !== PaymentProcessingStatus.pending) {
        throw new BadRequestException('Payment is not in pending state');
      }

      // Mark payment as succeeded
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.succeeded,
          succeededAt: new Date(),
          responseMeta: {
            completedAt: new Date().toISOString(),
            completionMethod: 'cash_collection',
            collectedBy: 'delivery_person', // In real implementation, this would be the actual delivery person ID
          },
        },
      });

      // Update order payment status to paid
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

      // Update order status to completed
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'completed',
          deliveredAt: new Date(),
        },
      });

      // Update inventory on payment success
      const { CheckoutHelper } = await import('../../checkout/checkout.helper');
      await this.prisma.$transaction(async (tx) => {
        await CheckoutHelper.updateInventoryOnPaymentSuccess(orderId, tx);
      });

      this.logger.log(
        `Cash payment completed for order ${orderId}, payment ${paymentId}`,
      );

      return {
        success: true,
        paymentId,
        status: PaymentProcessingStatus.succeeded,
        message: 'Cash payment completed successfully',
      };
    } catch (error) {
      this.logger.error(`Cash payment completion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cancel cash payment (called when order is cancelled)
   */
  async cancelPayment(
    paymentId: string,
    orderId: string,
  ): Promise<PaymentCompletionResult> {
    try {
      const payment = (await this.prisma.payment.findUnique({
        where: { id: paymentId },
      })) as PaymentWithOrderPayment | null;

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Mark payment as cancelled
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentProcessingStatus.cancelled,
          cancelledAt: new Date(),
          responseMeta: {
            cancelledAt: new Date().toISOString(),
            reason: 'order_cancelled',
          },
        },
      });

      // Update order payment status to cancelled
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

      // Restore product inventory
      await this.restoreProductInventory(orderId);

      this.logger.log(
        `Cash payment cancelled for order ${orderId}, payment ${paymentId}`,
      );

      return {
        success: true,
        paymentId,
        status: PaymentProcessingStatus.cancelled,
        message: 'Cash payment cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Cash payment cancellation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Restore product inventory when payment is cancelled
   */
  private async restoreProductInventory(orderId: string): Promise<void> {
    try {
      // Use the CheckoutHelper method for consistent inventory management
      const { CheckoutHelper } = await import('../../checkout/checkout.helper');

      await this.prisma.$transaction(async (tx) => {
        await CheckoutHelper.restoreInventoryOnPaymentFailure(orderId, tx);
      });

      this.logger.log(`Product inventory restored for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Error restoring product inventory: ${error.message}`);
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    let message = '';
    switch (payment.status) {
      case PaymentProcessingStatus.created:
        message = 'Cash payment created';
        break;
      case PaymentProcessingStatus.pending:
        message = 'Cash payment pending - will be collected upon delivery';
        break;
      case PaymentProcessingStatus.succeeded:
        message = 'Cash payment completed successfully';
        break;
      case PaymentProcessingStatus.failed:
        message = 'Cash payment failed';
        break;
      case PaymentProcessingStatus.cancelled:
        message = 'Cash payment cancelled';
        break;
      case PaymentProcessingStatus.refunded:
        message = 'Cash payment refunded';
        break;
      default:
        message = 'Unknown status';
    }

    return {
      status: payment.status,
      message,
    };
  }
}
