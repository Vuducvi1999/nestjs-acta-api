import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import {
  PaymentProcessingStatus,
  OrderStatus,
  PaymentStatus,
  RefundStatus,
} from '@prisma/client';

// Type definitions for analytics aggregates
interface PaymentMetrics {
  pendingCount: number;
  succeededCount: number;
  cancelledCount: number;
  failedCount: number;
  refundedCount: number;
  amountPending: number;
  amountSucceeded: number;
  amountRefunded: number;
  avgTimeToPaySec: number;
  regenCount: number;
}

interface OrderMetrics {
  ordersCreated: number;
  ordersPayable: number;
  ordersCompleted: number;
  ordersCancelled: number;
  aov: number;
  revenue: number;
}

interface RefundMetrics {
  refundsRequested: number;
  refundsApproved: number;
  refundsSucceeded: number;
  refundsCancelled: number;
  amountRefunded: number;
}

interface PaymentAggregate {
  day: Date;
  provider: string;
  method: string;
  warehouseId: string | null;
  saleChannelId: string | null;
  pendingCount: number;
  succeededCount: number;
  cancelledCount: number;
  failedCount: number;
  refundedCount: number;
  amountPending: number;
  amountSucceeded: number;
  amountRefunded: number;
  avgTimeToPaySec: number;
  regenCount: number;
}

interface OrderAggregate {
  day: Date;
  warehouseId?: string;
  saleChannelId?: string;
  ordersCreated: number;
  ordersPayable: number;
  ordersCompleted: number;
  ordersCancelled: number;
  aov: number;
  revenue: number;
}

interface RefundAggregate {
  day: Date;
  provider: string;
  method: string;
  warehouseId: string | null;
  saleChannelId: string | null;
  refundsRequested: number;
  refundsApproved: number;
  refundsSucceeded: number;
  refundsCancelled: number;
  amountRefunded: number;
}

@Injectable()
export class AnalyticsCronService {
  private readonly logger = new Logger(AnalyticsCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Refresh daily analytics aggregates
   * Runs every day at 2:00 AM UTC to compute yesterday's metrics
   */
  @Cron('0 2 * * *') // Every day at 2:00 AM UTC
  async refreshDailyAnalytics() {
    try {
      this.logger.log('Starting daily analytics refresh...');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Refresh payments analytics
      await this.refreshPaymentsAnalytics(yesterday);
      await this.refreshPaymentsAnalytics(today); // Partial today

      // Refresh orders analytics
      await this.refreshOrdersAnalytics(yesterday);
      await this.refreshOrdersAnalytics(today); // Partial today

      // Refresh refunds analytics
      await this.refreshRefundsAnalytics(yesterday);
      await this.refreshRefundsAnalytics(today); // Partial today

      this.logger.log('Daily analytics refresh completed successfully');
    } catch (error) {
      this.logger.error(
        `Daily analytics refresh failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Refresh payments daily aggregates
   */
  private async refreshPaymentsAnalytics(targetDate: Date): Promise<void> {
    const startTime = Date.now();
    const logId = `payments_${targetDate.toISOString().split('T')[0]}`;

    try {
      this.logger.log(
        `Refreshing payments analytics for ${targetDate.toISOString().split('T')[0]}`,
      );

      // Create refresh log entry
      const refreshLog = await this.prisma.analyticsRefreshLog.create({
        data: {
          tableName: 'payments',
          day: targetDate,
          status: 'started',
          startedAt: new Date(),
        },
      });

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get raw payment data for the day
      const payments = await this.prisma.payment.findMany({
        where: {
          createdAt: {
            gte: targetDate,
            lt: nextDay,
          },
        },
        include: {
          orderPayment: {
            include: {
              order: {
                select: {
                  warehouseId: true,
                  saleChannelId: true,
                },
              },
            },
          },
        },
      });

      // Group payments by dimensions
      const groupedPayments = this.groupPaymentsByDimensions(payments);

      // Calculate metrics for each group
      const aggregates: PaymentAggregate[] = [];

      for (const [key, groupPayments] of Object.entries(groupedPayments)) {
        const [provider = '', method = '', warehouseId, saleChannelId] =
          key.split('|');

        const metrics = this.calculatePaymentMetrics(groupPayments);

        const aggregateData: PaymentAggregate = {
          day: targetDate,
          provider: provider || '',
          method: method || '',
          ...metrics,
        };

        if (warehouseId) aggregateData.warehouseId = warehouseId;
        if (saleChannelId) aggregateData.saleChannelId = saleChannelId;

        aggregates.push(aggregateData);
      }

      // Upsert aggregates
      let upsertedCount = 0;
      for (const aggregate of aggregates as any[]) {
        await this.prisma.paymentsDailyAgg.upsert({
          where: {
            day_provider_method_warehouseId_saleChannelId: {
              day: aggregate.day,
              provider: aggregate.provider,
              method: aggregate.method,
              warehouseId: aggregate.warehouseId,
              saleChannelId: aggregate.saleChannelId,
            },
          },
          update: aggregate,
          create: aggregate,
        });
        upsertedCount++;
      }

      // Update refresh log
      await this.prisma.analyticsRefreshLog.update({
        where: { id: refreshLog.id },
        data: {
          status: 'completed',
          rowsProcessed: payments.length,
          rowsUpserted: upsertedCount,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Payments analytics refreshed: ${payments.length} payments processed, ${upsertedCount} aggregates upserted in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(`Payments analytics refresh failed: ${error.message}`);

      // Update refresh log with error
      await this.prisma.analyticsRefreshLog.updateMany({
        where: {
          tableName: 'payments',
          day: targetDate,
          status: 'started',
        },
        data: {
          status: 'failed',
          error: error.message,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Refresh orders daily aggregates
   */
  private async refreshOrdersAnalytics(targetDate: Date): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Refreshing orders analytics for ${targetDate.toISOString().split('T')[0]}`,
      );

      // Create refresh log entry
      const refreshLog = await this.prisma.analyticsRefreshLog.create({
        data: {
          tableName: 'orders',
          day: targetDate,
          status: 'started',
          startedAt: new Date(),
        },
      });

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get raw order data for the day
      const orders = await this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: targetDate,
            lt: nextDay,
          },
        },
        include: {
          payments: {
            where: {
              status: 'succeeded' as any,
            },
          },
        },
      });

      // Group orders by dimensions
      const groupedOrders = this.groupOrdersByDimensions(orders);

      // Calculate metrics for each group
      const aggregates: any[] = [];
      for (const [key, groupOrders] of Object.entries(groupedOrders)) {
        const [warehouseId, saleChannelId] = key.split('|');

        const metrics = this.calculateOrderMetrics(groupOrders);

        aggregates.push({
          day: targetDate,
          warehouseId: warehouseId || null,
          saleChannelId: saleChannelId || null,
          ...metrics,
        });
      }

      // Upsert aggregates
      let upsertedCount = 0;
      for (const aggregate of aggregates as any[]) {
        await this.prisma.ordersDailyAgg.upsert({
          where: {
            day_warehouseId_saleChannelId: {
              day: aggregate.day,
              warehouseId: aggregate.warehouseId,
              saleChannelId: aggregate.saleChannelId,
            },
          },
          update: aggregate,
          create: aggregate,
        });
        upsertedCount++;
      }

      // Update refresh log
      await this.prisma.analyticsRefreshLog.update({
        where: { id: refreshLog.id },
        data: {
          status: 'completed',
          rowsProcessed: orders.length,
          rowsUpserted: upsertedCount,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Orders analytics refreshed: ${orders.length} orders processed, ${upsertedCount} aggregates upserted in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(`Orders analytics refresh failed: ${error.message}`);

      // Update refresh log with error
      await this.prisma.analyticsRefreshLog.updateMany({
        where: {
          tableName: 'orders',
          day: targetDate,
          status: 'started',
        },
        data: {
          status: 'failed',
          error: error.message,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Refresh refunds daily aggregates
   */
  private async refreshRefundsAnalytics(targetDate: Date): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Refreshing refunds analytics for ${targetDate.toISOString().split('T')[0]}`,
      );

      // Create refresh log entry
      const refreshLog = await this.prisma.analyticsRefreshLog.create({
        data: {
          tableName: 'refunds',
          day: targetDate,
          status: 'started',
          startedAt: new Date(),
        },
      });

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get raw refund data for the day
      const refunds = await this.prisma.paymentRefund.findMany({
        where: {
          createdAt: {
            gte: targetDate,
            lt: nextDay,
          },
        },
        include: {
          payment: {
            include: {
              orderPayment: {
                include: {
                  order: {
                    select: {
                      warehouseId: true,
                      saleChannelId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Group refunds by dimensions
      const groupedRefunds = this.groupRefundsByDimensions(refunds);

      // Calculate metrics for each group
      const aggregates: RefundAggregate[] = [];
      for (const [key, groupRefunds] of Object.entries(groupedRefunds)) {
        const [provider = '', method = '', warehouseId, saleChannelId] =
          key.split('|');

        const metrics = this.calculateRefundMetrics(groupRefunds);

        const aggregateData: RefundAggregate = {
          day: targetDate,
          provider: provider as string,
          method: method as string,
          ...metrics,
        };

        if (warehouseId) aggregateData.warehouseId = warehouseId;
        if (saleChannelId) aggregateData.saleChannelId = saleChannelId;

        aggregates.push(aggregateData);
      }

      // Upsert aggregates
      let upsertedCount = 0;
      for (const aggregate of aggregates) {
        await this.prisma.refundsDailyAgg.upsert({
          where: {
            day_provider_method_warehouseId_saleChannelId: {
              day: aggregate.day,
              provider: aggregate.provider,
              method: aggregate.method,
              warehouseId: aggregate.warehouseId || '',
              saleChannelId: aggregate.saleChannelId || '',
            },
          },
          update: aggregate,
          create: aggregate,
        });
        upsertedCount++;
      }

      // Update refresh log
      await this.prisma.analyticsRefreshLog.update({
        where: { id: refreshLog.id },
        data: {
          status: 'completed',
          rowsProcessed: refunds.length,
          rowsUpserted: upsertedCount,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `Refunds analytics refreshed: ${refunds.length} refunds processed, ${upsertedCount} aggregates upserted in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.logger.error(`Refunds analytics refresh failed: ${error.message}`);

      // Update refresh log with error
      await this.prisma.analyticsRefreshLog.updateMany({
        where: {
          tableName: 'refunds',
          day: targetDate,
          status: 'started',
        },
        data: {
          status: 'failed',
          error: error.message,
          durationMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Group payments by dimensions
   */
  private groupPaymentsByDimensions(payments: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const payment of payments) {
      const provider = payment.provider || 'unknown';
      const method = payment.orderPayment?.method || 'unknown';
      const warehouseId = payment.orderPayment?.order?.warehouseId || 'unknown';
      const saleChannelId =
        payment.orderPayment?.order?.saleChannelId || 'unknown';

      const key = `${provider}|${method}|${warehouseId}|${saleChannelId}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(payment);
    }

    return grouped;
  }

  /**
   * Group orders by dimensions
   */
  private groupOrdersByDimensions(orders: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const order of orders) {
      const warehouseId = order.warehouseId || 'unknown';
      const saleChannelId = order.saleChannelId || 'unknown';

      const key = `${warehouseId}|${saleChannelId}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(order);
    }

    return grouped;
  }

  /**
   * Group refunds by dimensions
   */
  private groupRefundsByDimensions(refunds: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const refund of refunds) {
      const provider = refund.payment?.provider || 'unknown';
      const method = refund.payment?.orderPayment?.method || 'unknown';
      const warehouseId =
        refund.payment?.orderPayment?.order?.warehouseId || 'unknown';
      const saleChannelId =
        refund.payment?.orderPayment?.order?.saleChannelId || 'unknown';

      const key = `${provider}|${method}|${warehouseId}|${saleChannelId}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(refund);
    }

    return grouped;
  }

  /**
   * Calculate payment metrics for a group
   */
  private calculatePaymentMetrics(payments: any[]): any {
    const metrics = {
      pendingCount: 0,
      succeededCount: 0,
      cancelledCount: 0,
      failedCount: 0,
      refundedCount: 0,
      amountPending: 0,
      amountSucceeded: 0,
      amountRefunded: 0,
      avgTimeToPaySec: 0,
      regenCount: 0,
    };

    const succeededPayments: typeof payments = [];
    let totalTimeToPay = 0;

    for (const payment of payments) {
      const amount = Number(payment.amount);

      switch (payment.status) {
        case PaymentProcessingStatus.pending:
          metrics.pendingCount++;
          metrics.amountPending += amount;
          break;
        case PaymentProcessingStatus.succeeded:
          metrics.succeededCount++;
          metrics.amountSucceeded += amount;
          succeededPayments.push(payment);

          if (payment.succeededAt && payment.createdAt) {
            const timeToPay = Math.floor(
              (new Date(payment.succeededAt).getTime() -
                new Date(payment.createdAt).getTime()) /
                1000,
            );
            totalTimeToPay += timeToPay;
          }
          break;
        case PaymentProcessingStatus.cancelled:
          metrics.cancelledCount++;
          break;
        case PaymentProcessingStatus.failed:
          metrics.failedCount++;
          break;
        case PaymentProcessingStatus.refunded:
          metrics.refundedCount++;
          metrics.amountRefunded += amount;
          break;
      }
    }

    // Calculate average time to pay
    if (succeededPayments.length > 0) {
      metrics.avgTimeToPaySec = Math.round(
        totalTimeToPay / succeededPayments.length,
      );
    }

    // Calculate regeneration count (simplified - in production, use window functions)
    const orderPaymentMap = new Map();
    for (const payment of payments) {
      const orderId = payment.orderPayment?.orderId;
      if (orderId) {
        if (!orderPaymentMap.has(orderId)) {
          orderPaymentMap.set(orderId, []);
        }
        orderPaymentMap.get(orderId).push(payment);
      }
    }

    for (const [orderId, orderPayments] of orderPaymentMap) {
      const sortedPayments = orderPayments.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      for (let i = 1; i < sortedPayments.length; i++) {
        const prevPayment = sortedPayments[i - 1];
        const currentPayment = sortedPayments[i];

        if (
          prevPayment.status === PaymentProcessingStatus.cancelled &&
          currentPayment.status === PaymentProcessingStatus.pending
        ) {
          metrics.regenCount++;
        }
      }
    }

    return metrics;
  }

  /**
   * Calculate order metrics for a group
   */
  private calculateOrderMetrics(orders: any[]): any {
    const metrics = {
      ordersCreated: orders.length,
      ordersPayable: 0,
      ordersCompleted: 0,
      ordersCancelled: 0,
      aov: 0,
      revenue: 0,
    };

    let totalRevenue = 0;
    let ordersWithRevenue = 0;

    for (const order of orders) {
      switch (order.status) {
        case OrderStatus.draft:
        case OrderStatus.confirmed:
          metrics.ordersPayable++;
          break;
        case OrderStatus.completed:
          metrics.ordersCompleted++;
          break;
        case OrderStatus.cancelled:
          metrics.ordersCancelled++;
          break;
      }

      // Calculate revenue from succeeded payments
      const orderRevenue = order.payments.reduce(
        (sum: number, payment: any) => {
          return sum + Number(payment.amount);
        },
        0,
      );

      if (orderRevenue > 0) {
        totalRevenue += orderRevenue;
        ordersWithRevenue++;
      }
    }

    metrics.revenue = totalRevenue;
    metrics.aov = ordersWithRevenue > 0 ? totalRevenue / ordersWithRevenue : 0;

    return metrics;
  }

  /**
   * Calculate refund metrics for a group
   */
  private calculateRefundMetrics(refunds: any[]): any {
    const metrics = {
      refundsRequested: 0,
      refundsApproved: 0,
      refundsSucceeded: 0,
      refundsCancelled: 0,
      amountRefunded: 0,
    };

    for (const refund of refunds) {
      const amount = Number(refund.amount);

      switch (refund.status) {
        case RefundStatus.requested:
          metrics.refundsRequested++;
          break;
        case RefundStatus.approved:
          metrics.refundsApproved++;
          break;
        case RefundStatus.succeeded:
          metrics.refundsSucceeded++;
          metrics.amountRefunded += amount;
          break;
        case RefundStatus.cancelled:
          metrics.refundsCancelled++;
          break;
      }
    }

    return metrics;
  }

  /**
   * Manual trigger for analytics refresh (for testing)
   */
  async manualRefreshAnalytics(targetDate?: Date): Promise<{
    success: boolean;
    message: string;
    duration: number;
  }> {
    const startTime = Date.now();
    const date = targetDate || new Date();
    date.setHours(0, 0, 0, 0);

    try {
      this.logger.log(
        `Manual analytics refresh triggered for ${date.toISOString().split('T')[0]}`,
      );

      await this.refreshPaymentsAnalytics(date);
      await this.refreshOrdersAnalytics(date);
      await this.refreshRefundsAnalytics(date);

      const duration = Date.now() - startTime;

      return {
        success: true,
        message: `Analytics refresh completed successfully in ${duration}ms`,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        message: `Analytics refresh failed: ${error.message}`,
        duration,
      };
    }
  }
}
