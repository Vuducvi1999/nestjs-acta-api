import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { AnalyticsCronService } from './analytics-cron.service';
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

@ApiTags('Admin Reports')
@ApiBearerAuth()
@Controller('admin/reports')
@UseGuards() // TODO: Add RolesGuard with Roles('ADMIN', 'FINANCE')
@Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly analyticsCronService: AnalyticsCronService,
  ) {}

  @Get('payments/daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get payments daily aggregates',
    description:
      'Get daily payment metrics with filtering options (ADMIN/FINANCE only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payments daily aggregates retrieved successfully',
    type: [PaymentsDailyAggDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range or filters',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiQuery({
    name: 'start',
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'end',
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'provider',
    description: 'Payment provider filter',
    required: false,
    example: 'vietqr',
  })
  @ApiQuery({
    name: 'method',
    description: 'Payment method filter',
    required: false,
    example: 'transfer',
  })
  @ApiQuery({
    name: 'warehouseId',
    description: 'Warehouse ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'saleChannelId',
    description: 'Sale channel ID filter',
    required: false,
  })
  async getPaymentsDailyAgg(
    @Query() query: DateRangeQueryDto,
  ): Promise<PaymentsDailyAggDto[]> {
    this.logger.log(
      `Getting payments daily aggregates for ${query.start} to ${query.end}`,
    );
    return await this.reportsService.getPaymentsDailyAgg(query);
  }

  @Get('orders/daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get orders daily aggregates',
    description:
      'Get daily order metrics with filtering options (ADMIN/FINANCE only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders daily aggregates retrieved successfully',
    type: [OrdersDailyAggDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range or filters',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiQuery({
    name: 'start',
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'end',
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'warehouseId',
    description: 'Warehouse ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'saleChannelId',
    description: 'Sale channel ID filter',
    required: false,
  })
  async getOrdersDailyAgg(
    @Query() query: DateRangeQueryDto,
  ): Promise<OrdersDailyAggDto[]> {
    this.logger.log(
      `Getting orders daily aggregates for ${query.start} to ${query.end}`,
    );
    return await this.reportsService.getOrdersDailyAgg(query);
  }

  @Get('refunds/daily')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get refunds daily aggregates',
    description:
      'Get daily refund metrics with filtering options (ADMIN/FINANCE only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Refunds daily aggregates retrieved successfully',
    type: [RefundsDailyAggDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range or filters',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiQuery({
    name: 'start',
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'end',
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'provider',
    description: 'Payment provider filter',
    required: false,
    example: 'vietqr',
  })
  @ApiQuery({
    name: 'method',
    description: 'Payment method filter',
    required: false,
    example: 'transfer',
  })
  @ApiQuery({
    name: 'warehouseId',
    description: 'Warehouse ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'saleChannelId',
    description: 'Sale channel ID filter',
    required: false,
  })
  async getRefundsDailyAgg(
    @Query() query: DateRangeQueryDto,
  ): Promise<RefundsDailyAggDto[]> {
    this.logger.log(
      `Getting refunds daily aggregates for ${query.start} to ${query.end}`,
    );
    return await this.reportsService.getRefundsDailyAgg(query);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get summary metrics',
    description:
      'Get comprehensive summary metrics for the date range (ADMIN/FINANCE only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary metrics retrieved successfully',
    type: ReportsSummaryDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range or filters',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiQuery({
    name: 'start',
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'end',
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'provider',
    description: 'Payment provider filter',
    required: false,
    example: 'vietqr',
  })
  @ApiQuery({
    name: 'method',
    description: 'Payment method filter',
    required: false,
    example: 'transfer',
  })
  @ApiQuery({
    name: 'warehouseId',
    description: 'Warehouse ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'saleChannelId',
    description: 'Sale channel ID filter',
    required: false,
  })
  async getSummary(
    @Query() query: DateRangeQueryDto,
  ): Promise<ReportsSummaryDto> {
    this.logger.log(
      `Getting summary metrics for ${query.start} to ${query.end}`,
    );
    return await this.reportsService.getSummary(query);
  }

  @Get('drilldown/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get payment drilldown data',
    description:
      'Get detailed payment data with pagination (ADMIN/FINANCE only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment drilldown data retrieved successfully',
    type: PaginatedResponseDto<PaymentDrilldownDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid date range, filters, or pagination',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiQuery({
    name: 'start',
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'end',
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'provider',
    description: 'Payment provider filter',
    required: false,
    example: 'vietqr',
  })
  @ApiQuery({
    name: 'method',
    description: 'Payment method filter',
    required: false,
    example: 'transfer',
  })
  @ApiQuery({
    name: 'warehouseId',
    description: 'Warehouse ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'saleChannelId',
    description: 'Sale channel ID filter',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page',
    required: false,
    example: 50,
  })
  @ApiQuery({
    name: 'cursor',
    description: 'Cursor for pagination',
    required: false,
  })
  async getPaymentDrilldown(
    @Query() query: DateRangeQueryDto,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<PaymentDrilldownDto>> {
    this.logger.log(
      `Getting payment drilldown for ${query.start} to ${query.end}`,
    );
    return await this.reportsService.getPaymentDrilldown(query, pagination);
  }

  @Get('analytics/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually trigger analytics refresh',
    description: 'Manually trigger analytics refresh for testing (ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics refresh triggered successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 requests per 5 minutes
  async manualRefreshAnalytics(): Promise<{
    success: boolean;
    message: string;
    duration: number;
  }> {
    this.logger.log('Manual analytics refresh triggered');
    return await this.analyticsCronService.manualRefreshAnalytics();
  }

  @Get('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear reports cache',
    description: 'Clear all cached reports data (ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async clearCache(): Promise<{
    success: boolean;
    message: string;
  }> {
    this.logger.log('Clearing reports cache');
    await this.reportsService.clearCache();
    return {
      success: true,
      message: 'Reports cache cleared successfully',
    };
  }

  @Get('cache/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Get cache statistics for reports (ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getCacheStats(): Promise<{
    keys: string[];
    totalKeys: number;
  }> {
    this.logger.log('Getting cache statistics');
    return await this.reportsService.getCacheStats();
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reports health check',
    description: 'Check the health of the reports system',
  })
  @ApiResponse({
    status: 200,
    description: 'Reports system is healthy',
  })
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    version: string;
  }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
