import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // maximum number of items in cache
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PrismaService, ActivityLogService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
