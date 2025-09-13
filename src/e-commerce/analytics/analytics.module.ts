import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AnalyticsCronService } from './analytics-cron.service';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 minutes
      max: 100, // maximum number of items in cache
    }),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, AnalyticsCronService, PrismaService],
  exports: [ReportsService, AnalyticsCronService],
})
export class EcommerceAnalyticsModule {}
