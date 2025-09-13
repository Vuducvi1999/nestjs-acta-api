import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ActivityTargetType, ActivityType } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../common/services/prisma.service';
import {
  ActivityLogResponseDto,
  PaginatedActivityLogResponseDto,
} from './dto/activity-log-response.dto';
import { Cache } from 'cache-manager';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);
  private readonly CACHE_TTL = 120 * 1000; // 2 minutes in milliseconds

  /**
   * Get activity types by prefix (e.g., 'DOCUMENT_', 'TICKET_')
   */
  getActivityTypesByPrefix(prefix: string): ActivityType[] {
    return Object.values(ActivityType).filter((type) =>
      type.startsWith(prefix.toUpperCase() + '_'),
    );
  }

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    // Run cleanup on service initialization
    this.cleanupOrphanedActivityLogs().catch((error) => {
      this.logger.error(
        'Failed to cleanup orphaned activity logs on startup:',
        error,
      );
    });
  }

  async createActivityLog(
    targetId: string,
    targetType: ActivityTargetType,
    activityType: ActivityType,
    user: JwtPayload,
    description?: string,
    changes?: Record<string, any>,
  ): Promise<ActivityLogResponseDto> {
    try {
      const cacheKey = `activityLog:${targetId}:${targetType}:${activityType}`;
      const log = this.prisma.activityLog.create({
        data: {
          targetId,
          targetType,
          activityType,
          uploaderId: user.id,
          description,
          changes,
        },
      });

      // Cache the activity log for quick retrieval
      await this.cacheManager.set(cacheKey, log, this.CACHE_TTL);

      this.logger.log(
        `Activity log created for targetId: ${targetId}, targetType: ${targetType}, activityType: ${activityType}`,
      );

      return ActivityLogResponseDto.fromDocument(log);
    } catch (error) {
      this.logger.error(
        `Failed to create activity log for targetId: ${targetId}, targetType: ${targetType}, activityType: ${activityType}`,
        error.stack,
      );

      throw new Error(`Failed to create activity log: ${error.message}`);
    }
  }

  /**
   * Clean up orphaned activity logs (logs with invalid uploaderId references)
   */
  async cleanupOrphanedActivityLogs(): Promise<{ deleted: number }> {
    try {
      // Get all unique uploaderIds from activity logs
      const activityLogs = await this.prisma.activityLog.findMany({
        select: {
          uploaderId: true,
        },
        distinct: ['uploaderId'],
      });

      const uploaderIds = activityLogs.map((log) => log.uploaderId);

      // Find which uploaderIds don't exist in users table
      const existingUsers = await this.prisma.user.findMany({
        where: {
          id: {
            in: uploaderIds,
          },
        },
        select: {
          id: true,
        },
      });

      const existingUserIds = new Set(existingUsers.map((user) => user.id));
      const orphanedUploaderIds = uploaderIds.filter(
        (id) => !existingUserIds.has(id),
      );

      if (orphanedUploaderIds.length > 0) {
        this.logger.warn(
          `Found ${orphanedUploaderIds.length} orphaned uploaderIds: ${orphanedUploaderIds.join(', ')}`,
        );

        // Delete activity logs with orphaned uploaderIds
        const result = await this.prisma.activityLog.deleteMany({
          where: {
            uploaderId: {
              in: orphanedUploaderIds,
            },
          },
        });

        this.logger.log(`Deleted ${result.count} orphaned activity logs`);
        return { deleted: result.count };
      }

      return { deleted: 0 };
    } catch (error) {
      this.logger.error('Error cleaning up orphaned activity logs:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Get activity logs without uploader relation (fallback method)
   */
  private async findAllWithoutUploader(
    where: Prisma.ActivityLogWhereInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.activityLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });
  }

  async findAll(
    query: ActivityLogQueryDto = {},
  ): Promise<PaginatedActivityLogResponseDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.ActivityLogWhereInput = {};

    if (query.targetId) {
      where.targetId = query.targetId;
    }

    if (query.targetType) {
      where.targetType = query.targetType;
    }

    if (query.activityType) {
      where.activityType = query.activityType;
    }

    if (query.uploaderId) {
      where.uploaderId = query.uploaderId;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};

      if (query.dateFrom) {
        const fromDate = new Date(query.dateFrom);
        where.createdAt.gte = fromDate;
        this.logger.log(`Filtering from date: ${fromDate.toISOString()}`);
      }

      if (query.dateTo) {
        // Set to end of day for dateTo
        const endDate = new Date(query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
        this.logger.log(`Filtering to date: ${endDate.toISOString()}`);
      }
    }

    if (query.searchQuery) {
      where.OR = [
        { description: { contains: query.searchQuery, mode: 'insensitive' } },
        { targetId: { contains: query.searchQuery, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination (only valid logs with uploaders)
    const total = await this.prisma.activityLog.count({
      where: {
        ...where,
        uploaderId: {
          not: undefined,
        },
      },
    });

    // Get activity logs with pagination
    let activityLogs;
    try {
      activityLogs = await this.prisma.activityLog.findMany({
        where,
        include: {
          uploader: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: true,
              role: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });
    } catch (error) {
      this.logger.warn(
        'Activity logs with invalid uploader relations found, fetching without uploader data',
      );
      // Fallback: fetch without uploader relation
      activityLogs = await this.findAllWithoutUploader(where, skip, limit);
    }

    // Map to response DTOs, filtering out logs without valid uploaders
    const data = activityLogs
      .filter((log) => log.uploader) // Only include logs with valid uploaders
      .map((log) => ActivityLogResponseDto.fromDocument(log));

    // Use the total count for pagination calculation
    const totalPages = Math.ceil(total / limit);

    return PaginatedActivityLogResponseDto.fromPaginatedResult({
      data,
      total,
      page,
      limit,
      totalPages,
    });
  }
}
