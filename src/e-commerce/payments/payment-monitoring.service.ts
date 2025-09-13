import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import { PaymentEventsService } from './payment-events.service';
import { PaymentProcessingStatus } from '@prisma/client';

@Injectable()
export class PaymentMonitoringService {
  private readonly logger = new Logger(PaymentMonitoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  /**
   * Check for payments that are about to expire and send warnings
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkPaymentExpiry() {
    try {
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      // Find payments that will expire in the next 10 minutes
      const expiringPayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentProcessingStatus.pending,
          expiresAt: {
            gte: now,
            lte: tenMinutesFromNow,
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

      for (const payment of expiringPayments) {
        if (!payment.orderPayment?.orderId) continue;

        const timeUntilExpiry = payment.expiresAt!.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeUntilExpiry / 60000);

        // Send warning if payment expires in 5 minutes or less
        if (timeUntilExpiry <= 5 * 60 * 1000) {
          this.logger.warn(
            `Payment ${payment.id} expires in ${minutesLeft} minutes`,
          );

          // Emit expiry warning via WebSocket
          this.paymentEvents.emitPaymentExpiryWarning(
            payment.id,
            payment.orderPayment.orderId,
            minutesLeft,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error checking payment expiry: ${error.message}`);
    }
  }

  /**
   * Mark expired payments as failed
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markExpiredPayments() {
    try {
      const now = new Date();

      // Find expired pending payments
      const expiredPayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentProcessingStatus.pending,
          expiresAt: {
            lt: now,
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

      for (const payment of expiredPayments) {
        if (!payment.orderPayment?.orderId) continue;

        const orderId = payment.orderPayment.orderId;
        this.logger.warn(`Marking expired payment ${payment.id} as failed`);

        try {
          // Update payment status to failed
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentProcessingStatus.failed,
              failedAt: now,
              responseMeta: {
                ...((payment.responseMeta as any) || {}),
                expiredAt: now.toISOString(),
                reason: 'payment_timeout',
              },
            },
          });

          // Update order payment status
          await this.prisma.orderPayment.updateMany({
            where: {
              orderId: orderId,
              payment: {
                id: payment.id,
              },
            },
            data: {
              status: 'failed',
            },
          });

          // Update order status to cancelled
          await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'cancelled' },
          });

          // Restore product inventory
          const { CheckoutHelper } = await import(
            '../checkout/checkout.helper'
          );
          await this.prisma.$transaction(async (tx) => {
            await CheckoutHelper.restoreInventoryOnPaymentFailure(orderId, tx);
          });

          // Emit payment failure event via WebSocket
          this.paymentEvents.emitPaymentFailure(
            payment.id,
            orderId,
            'Payment expired',
          );

          this.logger.log(
            `Successfully marked expired payment ${payment.id} as failed`,
          );
        } catch (error) {
          this.logger.error(
            `Error marking expired payment ${payment.id} as failed: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error marking expired payments: ${error.message}`);
    }
  }

  /**
   * Send payment status updates to monitoring users
   * Runs every 30 seconds for active payments
   */
  @Cron('*/30 * * * * *')
  async sendPaymentStatusUpdates() {
    try {
      const now = new Date();
      const activePayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentProcessingStatus.pending,
          expiresAt: {
            gt: now,
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

      for (const payment of activePayments) {
        if (!payment.orderPayment?.orderId) continue;

        const timeUntilExpiry = payment.expiresAt!.getTime() - now.getTime();
        const minutesLeft = Math.floor(timeUntilExpiry / 60000);

        // Send status update with remaining time
        this.paymentEvents.emitPaymentStatusUpdate(
          payment.id,
          payment.orderPayment?.orderId || '',
          payment.status,
          `Payment pending - expires in ${minutesLeft} minutes`,
          payment.expiresAt || undefined,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending payment status updates: ${error.message}`,
      );
    }
  }

  /**
   * Clean up old failed/cancelled payments
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldPayments() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find old failed/cancelled payments
      const oldPayments = await this.prisma.payment.findMany({
        where: {
          status: {
            in: [
              PaymentProcessingStatus.failed,
              PaymentProcessingStatus.cancelled,
            ],
          },
          updatedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      if (oldPayments.length > 0) {
        this.logger.log(
          `Cleaning up ${oldPayments.length} old failed/cancelled payments`,
        );

        // You might want to archive these instead of deleting
        // For now, we'll just log them
        for (const payment of oldPayments) {
          this.logger.debug(
            `Old payment: ${payment.id} - ${payment.status} - ${payment.updatedAt}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error cleaning up old payments: ${error.message}`);
    }
  }
}
