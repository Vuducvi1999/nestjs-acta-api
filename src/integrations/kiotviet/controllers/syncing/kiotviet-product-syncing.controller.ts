import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
  Logger,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '../../../../common/enums/role.enum';
import { JwtPayload } from '../../../../auth/jwt-payload';
import { CurrentUser } from '../../../../users/users.decorator';
import { KiotVietProductSyncService } from '../../services/kiotviet-syncing/products';
import { KiotVietSyncLogService } from '../../services/kiotviet-sync-log.service';
import { SyncDirection, SyncEntityType, SyncStatus } from '@prisma/client';

@ApiBearerAuth()
@ApiTags('KiotViet: Product Syncing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/sync')
export class KiotVietProductSyncingController {
  private readonly logger = new Logger(KiotVietProductSyncingController.name);

  constructor(
    private readonly syncingService: KiotVietProductSyncService,
    private readonly syncLogService: KiotVietSyncLogService,
  ) {}

  /**
   * Synchronize products from KiotViet with full CREATE, UPDATE, DELETE operations
   * POST /integrations/kiotviet/sync/products
   */
  @Post('products')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Product Synchronization',
    description:
      'Synchronize products with full CREATE, UPDATE, DELETE operations based on KiotViet unique fields',
  })
  @ApiResponse({
    status: 200,
    description: 'Product sync completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            syncLogId: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                totalRecords: { type: 'number' },
                successCount: { type: 'number' },
                failedCount: { type: 'number' },
                duration: { type: 'number' },
              },
            },
            crudStats: {
              type: 'object',
              properties: {
                created: { type: 'number' },
                updated: { type: 'number' },
                deleted: { type: 'number' },
                errors: { type: 'number' },
                totalProcessed: { type: 'number' },
              },
            },
            errors: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  async syncProducts(@CurrentUser() user: JwtPayload) {
    const startTime = new Date();
    try {
      this.logger.log(`Starting product sync for user: ${user.email}`);

      const result = await this.syncingService.syncKiotVietProductsToActa(user);

      const duration = new Date().getTime() - startTime.getTime();
      this.logger.log(
        `Product sync completed for user: ${user.email} - Success: ${result.success}, Duration: ${duration}ms`,
      );

      return {
        success: true,
        message: 'Đồng bộ sản phẩm từ KiotViet thành công',
        data: {
          syncLogId: result.syncLogId,
          summary: {
            totalRecords: result.details.totalRecords,
            successCount: result.details.successCount,
            failedCount: result.details.failedCount,
            duration: duration,
          },
          productStats: result.details.productStats,
          errors:
            result.details.errorDetails &&
            result.details.errorDetails.length > 0
              ? result.details.errorDetails.slice(0, 10) // Limit to first 10 errors
              : [],
        },
      };
    } catch (error) {
      this.logger.error(
        `Product sync failed for user: ${user.email}`,
        error.stack,
      );

      // Handle specific error types
      if (error.code === 'P2002') {
        throw new HttpException(
          {
            success: false,
            message: 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.',
            error: 'Unique constraint violation',
          },
          HttpStatus.CONFLICT,
        );
      }

      if (error.code === 'P2025') {
        throw new HttpException(
          {
            success: false,
            message: 'Không tìm thấy dữ liệu cần thiết.',
            error: 'Required data not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (error.message?.includes('timeout')) {
        throw new HttpException(
          {
            success: false,
            message:
              'Quá trình đồng bộ mất quá nhiều thời gian. Vui lòng thử lại.',
            error: 'Sync timeout',
          },
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      throw new HttpException(
        {
          success: false,
          message: 'Đồng bộ sản phẩm thất bại. Vui lòng thử lại sau.',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sync status by sync log ID
   * GET /integrations/kiotviet/sync/status/:syncLogId
   */
  @Get('status/:syncLogId')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get Sync Status by ID',
    description: 'Get detailed sync status information by sync log ID',
  })
  async getSyncStatus(@Param('syncLogId') syncLogId: string) {
    try {
      const syncLog = await this.syncLogService.prisma.syncLog.findUnique({
        where: { id: syncLogId },
      });

      if (!syncLog) {
        throw new HttpException(
          {
            success: false,
            message: 'Không tìm thấy thông tin đồng bộ',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: {
          id: syncLog.id,
          direction: syncLog.direction,
          entityType: syncLog.entityType,
          status: syncLog.status,
          details: syncLog.details,
          startTime: syncLog.startTime,
          endTime: syncLog.endTime,
          duration: syncLog.endTime
            ? syncLog.endTime.getTime() - syncLog.startTime.getTime()
            : null,
          createdAt: syncLog.createdAt,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to get sync status: ${syncLogId}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy thông tin trạng thái đồng bộ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get latest sync status for products with running state
   * GET /integrations/kiotviet/sync/latest
   */
  @Get('latest')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get Latest Sync Status',
    description:
      'Get the latest synchronization status including running state',
  })
  async getLatestSyncStatus() {
    try {
      const latestSync = await this.syncLogService.getLatestSyncLog(
        SyncEntityType.PRODUCT,
        SyncDirection.KIOTVIET_TO_ACTA,
      );

      if (!latestSync) {
        return {
          success: true,
          message: 'Chưa có lần đồng bộ nào',
          data: {
            isRunning: false,
            sync: null,
          },
        };
      }

      const isRunning =
        latestSync.status === SyncStatus.PENDING && latestSync.endTime === null;

      return {
        success: true,
        data: {
          isRunning,
          runningDuration:
            isRunning && latestSync.startTime
              ? Date.now() - latestSync.startTime.getTime()
              : null,
          sync: {
            id: latestSync.id,
            direction: latestSync.direction,
            entityType: latestSync.entityType,
            status: latestSync.status,
            details: latestSync.details,
            startTime: latestSync.startTime,
            endTime: latestSync.endTime,
            duration: latestSync.endTime
              ? latestSync.endTime.getTime() - latestSync.startTime.getTime()
              : null,
            createdAt: latestSync.createdAt,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get latest sync status', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy thông tin đồng bộ mới nhất',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sync history with pagination and optional statistics
   * GET /integrations/kiotviet/sync/history?page=1&limit=10&includeStats=true
   */
  @Get('history')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get Sync History',
    description: 'Get paginated sync history with optional statistics',
  })
  async getSyncHistory(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('includeStats') includeStats: string = 'false',
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 items per page
      const skip = (pageNum - 1) * limitNum;

      const shouldIncludeStats = includeStats.toLowerCase() === 'true';

      const baseQueries = [
        this.syncLogService.prisma.syncLog.findMany({
          where: {
            entityType: SyncEntityType.PRODUCT,
            direction: SyncDirection.KIOTVIET_TO_ACTA,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        this.syncLogService.prisma.syncLog.count({
          where: {
            entityType: SyncEntityType.PRODUCT,
            direction: SyncDirection.KIOTVIET_TO_ACTA,
          },
        }),
      ];

      const statsQueries = shouldIncludeStats
        ? [
            this.syncLogService.prisma.syncLog.count({
              where: {
                entityType: SyncEntityType.PRODUCT,
                direction: SyncDirection.KIOTVIET_TO_ACTA,
                status: SyncStatus.SUCCESS,
              },
            }),
            this.syncLogService.prisma.syncLog.count({
              where: {
                entityType: SyncEntityType.PRODUCT,
                direction: SyncDirection.KIOTVIET_TO_ACTA,
                status: SyncStatus.FAILED,
              },
            }),
            this.syncLogService.prisma.syncLog.count({
              where: {
                entityType: SyncEntityType.PRODUCT,
                direction: SyncDirection.KIOTVIET_TO_ACTA,
                status: SyncStatus.PARTIAL,
              },
            }),
          ]
        : [];

      const results = await Promise.all([...baseQueries, ...statsQueries]);
      const syncLogs = results[0] as any[];
      const total = results[1] as number;
      const [successfulSyncs, failedSyncs, partialSyncs] = shouldIncludeStats
        ? (results.slice(2) as number[])
        : [0, 0, 0];

      const totalPages = Math.ceil(total / limitNum);
      const successRate =
        shouldIncludeStats && total > 0 ? (successfulSyncs / total) * 100 : 0;

      const response: any = {
        success: true,
        data: {
          logs: syncLogs.map((log) => ({
            id: log.id,
            status: log.status,
            details: log.details,
            startTime: log.startTime,
            endTime: log.endTime,
            duration: log.endTime
              ? log.endTime.getTime() - log.startTime.getTime()
              : null,
            createdAt: log.createdAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
        },
      };

      if (shouldIncludeStats) {
        response.data.statistics = {
          totalSyncs: total,
          successfulSyncs,
          failedSyncs,
          partialSyncs,
          successRate: Math.round(successRate * 100) / 100,
        };
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to get sync history', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy lịch sử đồng bộ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint
   * GET /integrations/kiotviet/sync/health
   */
  @Get('health')
  @ApiOperation({
    summary: 'Health Check',
    description: 'Check sync service health and database connectivity',
  })
  async getHealth() {
    try {
      // Check database connection
      await this.syncLogService.prisma.$queryRaw`SELECT 1`;

      const latestSync = await this.syncLogService.getLatestSyncLog(
        SyncEntityType.PRODUCT,
        SyncDirection.KIOTVIET_TO_ACTA,
      );

      const isHealthy = !latestSync || latestSync.status !== SyncStatus.FAILED;

      return {
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          database: 'connected',
          lastSyncStatus: latestSync?.status || 'no_sync',
          lastSyncTime: latestSync?.createdAt || null,
        },
      };
    } catch (error) {
      this.logger.error('Health check failed', error.stack);
      return {
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: error.message,
        },
      };
    }
  }
}
