import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  DateRangeQueryDto,
  PaginationQueryDto,
  PaymentsDailyAggDto,
  OrdersDailyAggDto,
  RefundsDailyAggDto,
  ReportsSummaryDto,
  PaymentDrilldownDto,
  PaginatedResponseDto,
} from './dto/analytics.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get payments daily aggregates
   */
  async getPaymentsDailyAgg(
    query: DateRangeQueryDto,
  ): Promise<PaymentsDailyAggDto[]> {
    const cacheKey = `payments_daily_agg:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheManager.get<PaymentsDailyAggDto[]>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Returning cached payments daily aggregates for ${cacheKey}`,
      );
      return cached;
    }

    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    const whereClause: any = {
      day: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (query.provider) {
      whereClause.provider = query.provider;
    }
    if (query.method) {
      whereClause.method = query.method;
    }
    if (query.warehouseId) {
      whereClause.warehouseId = query.warehouseId;
    }
    if (query.saleChannelId) {
      whereClause.saleChannelId = query.saleChannelId;
    }

    const aggregates = await this.prisma.paymentsDailyAgg.findMany({
      where: whereClause,
      orderBy: {
        day: 'asc',
      },
    });

    const result = aggregates.map((agg) => ({
      day: agg.day.toISOString().split('T')[0],
      provider: agg.provider,
      method: agg.method,
      warehouseId: agg.warehouseId || undefined,
      saleChannelId: agg.saleChannelId || undefined,
      pendingCount: agg.pendingCount,
      succeededCount: agg.succeededCount,
      cancelledCount: agg.cancelledCount,
      failedCount: agg.failedCount,
      refundedCount: agg.refundedCount,
      amountPending: Number(agg.amountPending),
      amountSucceeded: Number(agg.amountSucceeded),
      amountRefunded: Number(agg.amountRefunded),
      avgTimeToPaySec: agg.avgTimeToPaySec,
      regenCount: agg.regenCount,
    }));

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300000);

    return result;
  }

  /**
   * Get orders daily aggregates
   */
  async getOrdersDailyAgg(
    query: DateRangeQueryDto,
  ): Promise<OrdersDailyAggDto[]> {
    const cacheKey = `orders_daily_agg:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheManager.get<OrdersDailyAggDto[]>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Returning cached orders daily aggregates for ${cacheKey}`,
      );
      return cached;
    }

    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    const whereClause: any = {
      day: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (query.warehouseId) {
      whereClause.warehouseId = query.warehouseId;
    }
    if (query.saleChannelId) {
      whereClause.saleChannelId = query.saleChannelId;
    }

    const aggregates = await this.prisma.ordersDailyAgg.findMany({
      where: whereClause,
      orderBy: {
        day: 'asc',
      },
    });

    const result = aggregates.map((agg) => ({
      day: agg.day.toISOString().split('T')[0],
      warehouseId: agg.warehouseId || undefined,
      saleChannelId: agg.saleChannelId || undefined,
      ordersCreated: agg.ordersCreated,
      ordersPayable: agg.ordersPayable,
      ordersCompleted: agg.ordersCompleted,
      ordersCancelled: agg.ordersCancelled,
      aov: Number(agg.aov),
      revenue: Number(agg.revenue),
    }));

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300000);

    return result;
  }

  /**
   * Get refunds daily aggregates
   */
  async getRefundsDailyAgg(
    query: DateRangeQueryDto,
  ): Promise<RefundsDailyAggDto[]> {
    const cacheKey = `refunds_daily_agg:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheManager.get<RefundsDailyAggDto[]>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Returning cached refunds daily aggregates for ${cacheKey}`,
      );
      return cached;
    }

    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    const whereClause: any = {
      day: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (query.provider) {
      whereClause.provider = query.provider;
    }
    if (query.method) {
      whereClause.method = query.method;
    }
    if (query.warehouseId) {
      whereClause.warehouseId = query.warehouseId;
    }
    if (query.saleChannelId) {
      whereClause.saleChannelId = query.saleChannelId;
    }

    const aggregates = await this.prisma.refundsDailyAgg.findMany({
      where: whereClause,
      orderBy: {
        day: 'asc',
      },
    });

    const result = aggregates.map((agg) => ({
      day: agg.day.toISOString().split('T')[0],
      provider: agg.provider,
      method: agg.method,
      warehouseId: agg.warehouseId || undefined,
      saleChannelId: agg.saleChannelId || undefined,
      refundsRequested: agg.refundsRequested,
      refundsApproved: agg.refundsApproved,
      refundsSucceeded: agg.refundsSucceeded,
      refundsCancelled: agg.refundsCancelled,
      amountRefunded: Number(agg.amountRefunded),
    }));

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300000);

    return result;
  }

  /**
   * Get summary metrics for the date range
   */
  async getSummary(query: DateRangeQueryDto): Promise<ReportsSummaryDto> {
    const cacheKey = `reports_summary:${JSON.stringify(query)}`;

    // Try to get from cache first
    const cached = await this.cacheManager.get<ReportsSummaryDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached summary for ${cacheKey}`);
      return cached;
    }

    // Get aggregated data
    const [paymentsAgg, ordersAgg, refundsAgg] = await Promise.all([
      this.getPaymentsDailyAgg(query),
      this.getOrdersDailyAgg(query),
      this.getRefundsDailyAgg(query),
    ]);

    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(
      paymentsAgg,
      ordersAgg,
      refundsAgg,
    );

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, summary, 300000);

    return summary;
  }

  /**
   * Get payment drilldown data with pagination
   */
  async getPaymentDrilldown(
    query: DateRangeQueryDto,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<PaymentDrilldownDto>> {
    const startDate = new Date(query.start);
    const endDate = new Date(query.end);

    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (query.provider) {
      whereClause.provider = query.provider;
    }
    if (query.method) {
      whereClause.orderPayment = {
        method: query.method,
      };
    }
    if (query.warehouseId) {
      whereClause.orderPayment = {
        ...whereClause.orderPayment,
        order: {
          warehouseId: query.warehouseId,
        },
      };
    }
    if (query.saleChannelId) {
      whereClause.orderPayment = {
        ...whereClause.orderPayment,
        order: {
          ...whereClause.orderPayment?.order,
          saleChannelId: query.saleChannelId,
        },
      };
    }

    // Handle cursor pagination
    let cursorClause = {};
    if (pagination.cursor) {
      try {
        const cursorData = JSON.parse(
          Buffer.from(pagination.cursor, 'base64').toString(),
        );
        cursorClause = {
          OR: [
            {
              updatedAt: {
                lt: new Date(cursorData.updatedAt),
              },
            },
            {
              updatedAt: new Date(cursorData.updatedAt),
              id: {
                lt: cursorData.id,
              },
            },
          ],
        };
      } catch (error) {
        this.logger.warn(`Invalid cursor provided: ${pagination.cursor}`);
      }
    }

    const limit = pagination.limit || 50;

    // Get total count
    const totalCount = await this.prisma.payment.count({
      where: {
        ...whereClause,
        ...cursorClause,
      },
    });

    // Get paginated data
    const payments = await this.prisma.payment.findMany({
      where: {
        ...whereClause,
        ...cursorClause,
      },
      include: {
        orderPayment: {
          include: {
            order: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // Take one extra to check if there are more
    });

    const hasMore = payments.length > limit;
    const data = payments.slice(0, limit).map((payment) => ({
      id: payment.id,
      code: payment.code,
      orderId: payment.orderPayment?.order?.id || '',
      orderCode: payment.orderPayment?.order?.code || '',
      provider: payment.provider,
      method: payment.orderPayment?.method || '',
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      createdAt: payment.createdAt.toISOString(),
      succeededAt: payment.succeededAt?.toISOString(),
      expiresAt: payment.expiresAt?.toISOString(),
      timeToPaySec:
        payment.succeededAt && payment.createdAt
          ? Math.floor(
              (new Date(payment.succeededAt).getTime() -
                new Date(payment.createdAt).getTime()) /
                1000,
            )
          : undefined,
    }));

    // Generate next cursor
    let nextCursor: string | undefined;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      const cursorData = {
        id: lastItem.id,
        updatedAt: lastItem.createdAt,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
      data,
      nextCursor,
      hasMore,
      totalCount,
    };
  }

  /**
   * Calculate summary metrics from aggregated data
   */
  private calculateSummaryMetrics(
    paymentsAgg: PaymentsDailyAggDto[],
    ordersAgg: OrdersDailyAggDto[],
    refundsAgg: RefundsDailyAggDto[],
  ): ReportsSummaryDto {
    // Aggregate payments data
    const paymentsSummary = paymentsAgg.reduce(
      (acc, day) => ({
        pendingCount: acc.pendingCount + day.pendingCount,
        succeededCount: acc.succeededCount + day.succeededCount,
        cancelledCount: acc.cancelledCount + day.cancelledCount,
        amountSucceeded: acc.amountSucceeded + day.amountSucceeded,
        totalTimeToPay:
          acc.totalTimeToPay + day.avgTimeToPaySec * day.succeededCount,
        regenCount: acc.regenCount + day.regenCount,
        totalPayments:
          acc.totalPayments +
          day.pendingCount +
          day.succeededCount +
          day.cancelledCount +
          day.failedCount,
      }),
      {
        pendingCount: 0,
        succeededCount: 0,
        cancelledCount: 0,
        amountSucceeded: 0,
        totalTimeToPay: 0,
        regenCount: 0,
        totalPayments: 0,
      },
    );

    // Aggregate orders data
    const ordersSummary = ordersAgg.reduce(
      (acc, day) => ({
        ordersCreated: acc.ordersCreated + day.ordersCreated,
        revenue: acc.revenue + day.revenue,
        ordersWithRevenue: acc.ordersWithRevenue + (day.revenue > 0 ? 1 : 0),
      }),
      {
        ordersCreated: 0,
        revenue: 0,
        ordersWithRevenue: 0,
      },
    );

    // Aggregate refunds data
    const refundsSummary = refundsAgg.reduce(
      (acc, day) => ({
        refundsSucceeded: acc.refundsSucceeded + day.refundsSucceeded,
        amountRefunded: acc.amountRefunded + day.amountRefunded,
      }),
      {
        refundsSucceeded: 0,
        amountRefunded: 0,
      },
    );

    // Calculate rates and metrics
    const paymentSuccessRate =
      paymentsSummary.totalPayments > 0
        ? paymentsSummary.succeededCount / paymentsSummary.totalPayments
        : 0;

    const qrExpiryRate =
      paymentsSummary.pendingCount + paymentsSummary.cancelledCount > 0
        ? paymentsSummary.cancelledCount /
          (paymentsSummary.pendingCount + paymentsSummary.cancelledCount)
        : 0;

    const avgTimeToPaySec =
      paymentsSummary.succeededCount > 0
        ? Math.round(
            paymentsSummary.totalTimeToPay / paymentsSummary.succeededCount,
          )
        : 0;

    const aov =
      ordersSummary.ordersWithRevenue > 0
        ? ordersSummary.revenue / ordersSummary.ordersWithRevenue
        : 0;

    const refundRate =
      paymentsSummary.amountSucceeded > 0
        ? refundsSummary.amountRefunded / paymentsSummary.amountSucceeded
        : 0;

    const regenRate =
      paymentsSummary.totalPayments > 0
        ? paymentsSummary.regenCount / paymentsSummary.totalPayments
        : 0;

    return {
      paymentSuccessRate: Math.round(paymentSuccessRate * 10000) / 10000, // Round to 4 decimal places
      qrExpiryRate: Math.round(qrExpiryRate * 10000) / 10000,
      avgTimeToPaySec,
      revenue: ordersSummary.revenue,
      aov: Math.round(aov),
      refundRate: Math.round(refundRate * 10000) / 10000,
      regenRate: Math.round(regenRate * 10000) / 10000,
      totalOrders: ordersSummary.ordersCreated,
      totalPayments: paymentsSummary.totalPayments,
      totalRefunds: refundsSummary.refundsSucceeded,
    };
  }

  /**
   * Clear cache for all reports
   */
  async clearCache(): Promise<void> {
    const keys: string[] = [];
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => this.cacheManager.del(key)));
      this.logger.log(`Cleared ${keys.length} cache entries for reports`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    keys: string[];
    totalKeys: number;
  }> {
    const keys: string[] = [];
    return {
      keys,
      totalKeys: keys.length,
    };
  }
}
