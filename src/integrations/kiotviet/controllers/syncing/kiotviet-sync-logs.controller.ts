import {
  Controller,
  Get,
  Delete,
  UseGuards,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { Role } from '../../../../common/enums/role.enum';
import { KiotVietSyncLogService } from '../../services/kiotviet-sync-log.service';
import { SyncDirection, SyncEntityType, SyncStatus } from '@prisma/client';

@ApiBearerAuth()
@ApiTags('KiotViet: Sync Logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/logs')
export class KiotVietSyncLogsController {
  private readonly logger = new Logger(KiotVietSyncLogsController.name);

  constructor(private readonly syncLogService: KiotVietSyncLogService) {}

  /**
   * Get all sync logs with filtering and pagination
   * GET /integrations/kiotviet/logs?entityType=PRODUCT&direction=KIOTVIET_TO_ACTA&status=SUCCESS&page=1&limit=20
   */
  @Get()
  @Roles(Role.ADMIN)
  async getAllSyncLogs(
    @Query('entityType') entityType?: SyncEntityType,
    @Query('direction') direction?: SyncDirection,
    @Query('status') status?: SyncStatus,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (direction) where.direction = direction;
      if (status) where.status = status;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        this.syncLogService.prisma.syncLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        this.syncLogService.prisma.syncLog.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      return {
        success: true,
        data: {
          logs: logs.map((log) => ({
            id: log.id,
            direction: log.direction,
            entityType: log.entityType,
            status: log.status,
            entityId: log.entityId,
            details: log.details,
            startTime: log.startTime,
            endTime: log.endTime,
            duration: log.endTime
              ? log.endTime.getTime() - log.startTime.getTime()
              : null,
            createdAt: log.createdAt,
            updatedAt: log.updatedAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
          },
          filters: {
            entityType,
            direction,
            status,
            startDate,
            endDate,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get sync logs', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy danh sách logs đồng bộ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sync log by ID with detailed information
   * GET /integrations/kiotviet/logs/:id
   */
  @Get(':id')
  @Roles(Role.ADMIN)
  async getSyncLogById(@Param('id') id: string) {
    try {
      const log = await this.syncLogService.prisma.syncLog.findUnique({
        where: { id },
      });

      if (!log) {
        throw new HttpException(
          {
            success: false,
            message: 'Không tìm thấy log đồng bộ',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: {
          id: log.id,
          direction: log.direction,
          entityType: log.entityType,
          status: log.status,
          entityId: log.entityId,
          details: log.details,
          startTime: log.startTime,
          endTime: log.endTime,
          duration: log.endTime
            ? log.endTime.getTime() - log.startTime.getTime()
            : null,
          createdAt: log.createdAt,
          updatedAt: log.updatedAt,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to get sync log: ${id}`, error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy thông tin log đồng bộ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sync statistics by entity type
   * GET /integrations/kiotviet/logs/stats/:entityType
   */
  @Get('stats/:entityType')
  @Roles(Role.ADMIN)
  async getSyncStatsByEntityType(
    @Param('entityType') entityType: SyncEntityType,
    @Query('direction') direction?: SyncDirection,
    @Query('days') days: string = '30',
  ) {
    try {
      const daysNum = Math.min(365, Math.max(1, parseInt(days)));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const where: any = {
        entityType,
        createdAt: { gte: startDate },
      };
      if (direction) where.direction = direction;

      const [
        totalLogs,
        successLogs,
        failedLogs,
        partialLogs,
        pendingLogs,
        recentLogs,
      ] = await Promise.all([
        this.syncLogService.prisma.syncLog.count({ where }),
        this.syncLogService.prisma.syncLog.count({
          where: { ...where, status: SyncStatus.SUCCESS },
        }),
        this.syncLogService.prisma.syncLog.count({
          where: { ...where, status: SyncStatus.FAILED },
        }),
        this.syncLogService.prisma.syncLog.count({
          where: { ...where, status: SyncStatus.PARTIAL },
        }),
        this.syncLogService.prisma.syncLog.count({
          where: { ...where, status: SyncStatus.PENDING },
        }),
        this.syncLogService.prisma.syncLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            startTime: true,
            endTime: true,
            details: true,
            createdAt: true,
          },
        }),
      ]);

      const successRate = totalLogs > 0 ? (successLogs / totalLogs) * 100 : 0;

      // Calculate average duration for completed syncs
      const completedLogs = await this.syncLogService.prisma.syncLog.findMany({
        where: {
          ...where,
          status: { in: [SyncStatus.SUCCESS, SyncStatus.PARTIAL] },
          endTime: { not: null },
        },
        select: { startTime: true, endTime: true },
      });

      let averageDuration = 0;
      if (completedLogs.length > 0) {
        const totalDuration = completedLogs.reduce((sum, log) => {
          return sum + (log.endTime!.getTime() - log.startTime.getTime());
        }, 0);
        averageDuration = totalDuration / completedLogs.length;
      }

      return {
        success: true,
        data: {
          overview: {
            entityType,
            direction,
            period: `Last ${daysNum} days`,
            totalLogs,
            successLogs,
            failedLogs,
            partialLogs,
            pendingLogs,
            successRate: Math.round(successRate * 100) / 100,
            averageDuration: Math.round(averageDuration),
          },
          recentActivity: recentLogs.map((log) => ({
            id: log.id,
            status: log.status,
            startTime: log.startTime,
            endTime: log.endTime,
            duration: log.endTime
              ? log.endTime.getTime() - log.startTime.getTime()
              : null,
            summary: log.details,
            createdAt: log.createdAt,
          })),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get sync stats for entity type: ${entityType}`,
        error.stack,
      );
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy thống kê đồng bộ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get failed sync logs with error details
   * GET /integrations/kiotviet/logs/failures?page=1&limit=20
   */
  @Get('failures/list')
  @Roles(Role.ADMIN)
  async getFailedSyncLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('entityType') entityType?: SyncEntityType,
    @Query('direction') direction?: SyncDirection,
  ) {
    try {
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        status: SyncStatus.FAILED,
      };
      if (entityType) where.entityType = entityType;
      if (direction) where.direction = direction;

      const [logs, total] = await Promise.all([
        this.syncLogService.prisma.syncLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        this.syncLogService.prisma.syncLog.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limitNum);

      return {
        success: true,
        data: {
          failures: logs.map((log) => ({
            id: log.id,
            direction: log.direction,
            entityType: log.entityType,
            entityId: log.entityId,
            startTime: log.startTime,
            endTime: log.endTime,
            errorDetails: (log.details as any)?.errorDetails || [],
            failureReason:
              (log.details as any)?.errorDetails?.[0] || 'Unknown error',
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
    } catch (error) {
      this.logger.error('Failed to get failed sync logs', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy danh sách lỗi đồng bộ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Clean up old sync logs (older than specified days)
   * DELETE /integrations/kiotviet/logs/cleanup?days=90
   */
  @Delete('cleanup')
  @Roles(Role.ADMIN)
  async cleanupOldLogs(@Query('days') days: string = '90') {
    try {
      const daysNum = Math.max(30, parseInt(days)); // Minimum 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysNum);

      const deletedCount = await this.syncLogService.prisma.syncLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { in: [SyncStatus.SUCCESS, SyncStatus.FAILED] }, // Keep pending logs
        },
      });

      this.logger.log(
        `Cleaned up ${deletedCount.count} old sync logs older than ${daysNum} days`,
      );

      return {
        success: true,
        message: `Đã xóa ${deletedCount.count} logs cũ hơn ${daysNum} ngày`,
        data: {
          deletedCount: deletedCount.count,
          cutoffDate,
          retentionDays: daysNum,
        },
      };
    } catch (error) {
      this.logger.error('Failed to cleanup old logs', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể dọn dẹp logs cũ',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sync performance metrics
   * GET /integrations/kiotviet/logs/performance?days=7
   */
  @Get('performance/metrics')
  @Roles(Role.ADMIN)
  async getPerformanceMetrics(@Query('days') days: string = '7') {
    try {
      const daysNum = Math.min(365, Math.max(1, parseInt(days)));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      const logs = await this.syncLogService.prisma.syncLog.findMany({
        where: {
          createdAt: { gte: startDate },
          status: { in: [SyncStatus.SUCCESS, SyncStatus.PARTIAL] },
          endTime: { not: null },
        },
        select: {
          startTime: true,
          endTime: true,
          details: true,
          entityType: true,
          createdAt: true,
        },
      });

      // Calculate performance metrics
      const metrics = logs.reduce(
        (acc, log) => {
          const duration = log.endTime!.getTime() - log.startTime.getTime();
          const details = log.details as any;
          const recordsProcessed = details?.totalRecords || 0;

          acc.totalDuration += duration;
          acc.totalRecords += recordsProcessed;
          acc.syncCount++;

          if (duration > acc.maxDuration) {
            acc.maxDuration = duration;
            acc.slowestSync = log;
          }

          if (duration < acc.minDuration || acc.minDuration === 0) {
            acc.minDuration = duration;
            acc.fastestSync = log;
          }

          return acc;
        },
        {
          totalDuration: 0,
          totalRecords: 0,
          syncCount: 0,
          maxDuration: 0,
          minDuration: 0,
          slowestSync: null as any,
          fastestSync: null as any,
        },
      );

      const averageDuration =
        metrics.syncCount > 0 ? metrics.totalDuration / metrics.syncCount : 0;
      const averageRecordsPerSync =
        metrics.syncCount > 0 ? metrics.totalRecords / metrics.syncCount : 0;
      const recordsPerSecond =
        metrics.totalDuration > 0
          ? (metrics.totalRecords / metrics.totalDuration) * 1000
          : 0;

      return {
        success: true,
        data: {
          period: `Last ${daysNum} days`,
          summary: {
            totalSyncs: metrics.syncCount,
            totalRecordsProcessed: metrics.totalRecords,
            totalDuration: metrics.totalDuration,
            averageDuration: Math.round(averageDuration),
            averageRecordsPerSync: Math.round(averageRecordsPerSync),
            recordsPerSecond: Math.round(recordsPerSecond * 100) / 100,
          },
          extremes: {
            fastest: metrics.fastestSync
              ? {
                  duration: metrics.minDuration,
                  date: metrics.fastestSync.createdAt,
                  records:
                    (metrics.fastestSync.details as any)?.totalRecords || 0,
                }
              : null,
            slowest: metrics.slowestSync
              ? {
                  duration: metrics.maxDuration,
                  date: metrics.slowestSync.createdAt,
                  records:
                    (metrics.slowestSync.details as any)?.totalRecords || 0,
                }
              : null,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể lấy thông số hiệu suất',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a test sync log entry (for testing purposes)
   * POST /integrations/kiotviet/logs/test
   */
  @Post('test')
  @Roles(Role.ADMIN)
  async createTestSyncLog() {
    try {
      const testLogId = await this.syncLogService.startSyncLog(
        SyncDirection.KIOTVIET_TO_ACTA,
        SyncEntityType.PRODUCT,
        100,
      );

      // Simulate completion after a short delay
      setTimeout(async () => {
        try {
          await this.syncLogService.completeSyncLog(
            testLogId,
            SyncStatus.SUCCESS,
            {
              totalRecords: 100,
              successCount: 95,
              failedCount: 5,
              errorDetails: ['Test error 1', 'Test error 2'],
              categoryStats: {
                adds: 10,
                updates: 0,
                skips: 2,
                conflicts: 0,
                deletes: 0,
                errors: 0,
              },
              businessStats: {
                adds: 5,
                updates: 0,
                skips: 1,
                conflicts: 0,
                deletes: 0,
                errors: 0,
              },
              warehouseStats: {
                adds: 3,
                updates: 0,
                skips: 0,
                conflicts: 0,
                deletes: 0,
                errors: 0,
              },
              productStats: {
                adds: 90,
                updates: 0,
                skips: 5,
                conflicts: 3,
                deletes: 0,
                errors: 2,
              },
              userStats: {
                adds: 5,
                updates: 0,
                skips: 1,
                conflicts: 0,
                deletes: 0,
                errors: 0,
              },
            },
          );
        } catch (error) {
          this.logger.error('Failed to complete test sync log', error);
        }
      }, 2000);

      return {
        success: true,
        message: 'Test sync log tạo thành công',
        data: {
          testLogId,
          note: 'Test log sẽ được hoàn thành sau 2 giây',
        },
      };
    } catch (error) {
      this.logger.error('Failed to create test sync log', error.stack);
      throw new HttpException(
        {
          success: false,
          message: 'Không thể tạo test sync log',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
