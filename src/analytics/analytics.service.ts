import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../common/services/prisma.service';
import {
  AnalyticsQueryDto,
  TimeframeType,
  PeriodType,
} from './dto/analytics-query.dto';
import { AnalyticsResponseDto, MetricData } from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly CACHE_TTL = 10 * 1000; // 10 seconds in milliseconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getBusinessMetrics(
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    // Handle backward compatibility
    const periodType =
      query.periodType ||
      this.mapTimeframeToPeriodType((query as any).timeframe);
    const cacheKey = `analytics:${periodType}:${query.startDate || ''}:${query.endDate || ''}`;

    this.logger.log(`Analytics query received:`, {
      periodType,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    try {
      const cached =
        await this.cacheManager.get<AnalyticsResponseDto>(cacheKey);

      if (cached) {
        this.logger.log(`Cache hit for analytics: ${cacheKey}`);
        return cached;
      }

      const { currentPeriod, previousPeriod } = this.getDateRanges(
        periodType,
        query.startDate,
        query.endDate,
      );

      this.logger.log(`Fetching analytics for periods:`, {
        current: `${currentPeriod.start.toISOString()} to ${currentPeriod.end.toISOString()}`,
        previous: `${previousPeriod.start.toISOString()} to ${previousPeriod.end.toISOString()}`,
      });

      const [
        totalUsers,
        newUsers,
        totalPosts,
        newPosts,
        newComments,
        newLikes,
        previousNewUsers,
        previousNewPosts,
        previousNewComments,
        previousNewLikes,
      ] = await Promise.all([
        this.getTotalUsersUpToDate(currentPeriod.end),
        this.getNewUsers(currentPeriod.start, currentPeriod.end),
        this.getTotalPostsUpToDate(currentPeriod.end),
        this.getNewPosts(currentPeriod.start, currentPeriod.end),
        this.getNewComments(currentPeriod.start, currentPeriod.end),
        this.getNewLikes(currentPeriod.start, currentPeriod.end),
        this.getNewUsers(previousPeriod.start, previousPeriod.end),
        this.getNewPosts(previousPeriod.start, previousPeriod.end),
        this.getNewComments(previousPeriod.start, previousPeriod.end),
        this.getNewLikes(previousPeriod.start, previousPeriod.end),
      ]);

      const previousTotalUsers = await this.getTotalUsersBeforeDate(
        currentPeriod.start,
      );
      const previousTotalPosts = await this.getTotalPostsBeforeDate(
        currentPeriod.start,
      );

      const result = new AnalyticsResponseDto({
        totalUsers: this.calculateMetricData(totalUsers, previousTotalUsers),
        newUsers: this.calculateMetricData(newUsers, previousNewUsers),
        totalPosts: this.calculateMetricData(totalPosts, previousTotalPosts),
        newPosts: this.calculateMetricData(newPosts, previousNewPosts),
        newComments: this.calculateMetricData(newComments, previousNewComments),
        newLikes: this.calculateMetricData(newLikes, previousNewLikes),
        generatedAt: new Date(),
      });

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

      this.logger.log(
        `Analytics data cached successfully for key: ${cacheKey}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching analytics data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private mapTimeframeToPeriodType(timeframe?: TimeframeType): PeriodType {
    if (!timeframe) return PeriodType.MONTH;

    switch (timeframe) {
      case TimeframeType.DAY:
        return PeriodType.DATE;
      case TimeframeType.WEEK:
        return PeriodType.WEEK;
      case TimeframeType.MONTH:
        return PeriodType.MONTH;
      case TimeframeType.YEAR:
        return PeriodType.YEAR;
      default:
        return PeriodType.MONTH;
    }
  }

  private async getTotalUsersUpToDate(endDate: Date): Promise<number> {
    try {
      return await this.prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: {
            lte: endDate,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching total users up to date', error);
      return 0;
    }
  }

  private async getTotalUsersBeforeDate(beforeDate: Date): Promise<number> {
    try {
      return await this.prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: {
            lt: beforeDate,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching total users before date', error);
      return 0;
    }
  }

  private async getTotalPostsUpToDate(endDate: Date): Promise<number> {
    try {
      return await this.prisma.post.count({
        where: {
          deletedAt: null,
          createdAt: {
            lte: endDate,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching total posts up to date', error);
      return 0;
    }
  }

  private async getTotalPostsBeforeDate(beforeDate: Date): Promise<number> {
    try {
      return await this.prisma.post.count({
        where: {
          deletedAt: null,
          createdAt: {
            lt: beforeDate,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching total posts before date', error);
      return 0;
    }
  }

  private async getNewUsers(startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.prisma.user.count({
        where: {
          deletedAt: null,
          verificationDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching new users count', error);
      return 0;
    }
  }

  private async getNewPosts(startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.prisma.post.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
        },
      });
    } catch (error) {
      this.logger.error('Error fetching new posts count', error);
      return 0;
    }
  }

  private async getNewComments(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    try {
      return await this.prisma.comment.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
        },
      });
    } catch (error) {
      this.logger.error('Error fetching new comments count', error);
      return 0;
    }
  }

  private async getNewLikes(startDate: Date, endDate: Date): Promise<number> {
    try {
      return await this.prisma.reaction.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error fetching new likes count', error);
      return 0;
    }
  }

  private calculateMetricData(current: number, previous: number): MetricData {
    const trend =
      previous > 0
        ? Math.abs(Math.round(((current - previous) / previous) * 100))
        : 0;
    const percentageChange =
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

    return {
      current,
      previous,
      trend,
      percentageChange,
    };
  }

  private getDateRanges(
    periodType: PeriodType,
    startDateStr?: string,
    endDateStr?: string,
  ): {
    currentPeriod: { start: Date; end: Date };
    previousPeriod: { start: Date; end: Date };
  } {
    const now = new Date();
    const startDate = startDateStr ? new Date(startDateStr) : now;

    // If periodType is RANGE, use both startDate and endDate
    if (periodType === PeriodType.RANGE) {
      if (!startDateStr || !endDateStr) {
        throw new Error(
          'Both startDate and endDate are required for RANGE period type',
        );
      }

      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const duration = end.getTime() - start.getTime();

      return {
        currentPeriod: { start, end },
        previousPeriod: {
          start: new Date(start.getTime() - duration),
          end: start,
        },
      };
    }

    // For other period types, calculate based on startDate and periodType
    const currentPeriod = { start: new Date(), end: new Date() };
    const previousPeriod = { start: new Date(), end: new Date() };

    switch (periodType) {
      case PeriodType.DATE:
        currentPeriod.start = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          0,
          0,
          0,
          0,
        );
        currentPeriod.end = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          23,
          59,
          59,
          999,
        );
        previousPeriod.start = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate() - 1,
          0,
          0,
          0,
          0,
        );
        previousPeriod.end = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate() - 1,
          23,
          59,
          59,
          999,
        );
        break;

      case PeriodType.WEEK:
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() - startDate.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        currentPeriod.start = weekStart;
        currentPeriod.end = weekEnd;
        previousPeriod.start = new Date(
          weekStart.getTime() - 7 * 24 * 60 * 60 * 1000,
        );
        previousPeriod.end = new Date(weekStart);
        break;

      case PeriodType.MONTH:
        currentPeriod.start = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          1,
        );
        currentPeriod.end = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          1,
        );
        previousPeriod.start = new Date(
          startDate.getFullYear(),
          startDate.getMonth() - 1,
          1,
        );
        previousPeriod.end = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          1,
        );
        break;

      case PeriodType.YEAR:
        currentPeriod.start = new Date(startDate.getFullYear(), 0, 1);
        currentPeriod.end = new Date(startDate.getFullYear() + 1, 0, 1);
        previousPeriod.start = new Date(startDate.getFullYear() - 1, 0, 1);
        previousPeriod.end = new Date(startDate.getFullYear(), 0, 1);
        break;

      default:
        // Default to month if unknown period type
        currentPeriod.start = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          1,
        );
        currentPeriod.end = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1,
          1,
        );
        previousPeriod.start = new Date(
          startDate.getFullYear(),
          startDate.getMonth() - 1,
          1,
        );
        previousPeriod.end = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          1,
        );
        break;
    }

    return { currentPeriod, previousPeriod };
  }
}
