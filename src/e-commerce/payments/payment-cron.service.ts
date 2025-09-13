import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import { PaymentConfigService } from './payment-config.service';
import { PaymentProcessingStatus } from '@prisma/client';

@Injectable()
export class PaymentCronService {
  private readonly logger = new Logger(PaymentCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentConfig: PaymentConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredPayments() {
    const batchSize = this.paymentConfig.PAYMENT_CRON_BATCH_SIZE;

    try {
      this.logger.log('Starting expired payments cleanup...');

      // Find expired pending payments
      const expiredPayments = await this.prisma.payment.findMany({
        where: {
          status: PaymentProcessingStatus.pending,
          expiresAt: {
            lt: new Date(),
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
        take: batchSize,
      });

      if (expiredPayments.length === 0) {
        this.logger.log('No expired payments found');
        return;
      }

      this.logger.log(
        `Found ${expiredPayments.length} expired payments to process`,
      );

      // Process each expired payment
      for (const payment of expiredPayments) {
        await this.prisma.$transaction(async (tx) => {
          // Update payment status to cancelled
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentProcessingStatus.cancelled,
              cancelledAt: new Date(),
              responseMeta: {
                ...((payment.responseMeta as any) || {}),
                expiredAt: new Date().toISOString(),
                reason: 'payment_timeout',
              },
            },
          });

          // Update order payment status
          await tx.orderPayment.updateMany({
            where: {
              orderId: payment.orderPayment?.orderId,
              payment: {
                id: payment.id,
              },
            },
            data: {
              status: 'failed',
            },
          });

          // Restore inventory
          if (payment.orderPayment?.orderId) {
            const { CheckoutHelper } = await import(
              '../checkout/checkout.helper'
            );
            await CheckoutHelper.restoreInventoryOnPaymentFailure(
              payment.orderPayment.orderId,
              tx,
            );
          }
        });

        this.logger.log(`Expired payment ${payment.id} processed`);
      }

      this.logger.log(
        `Successfully processed ${expiredPayments.length} expired payments`,
      );
    } catch (error) {
      this.logger.error(`Error processing expired payments: ${error.message}`);
    }
  }
}
