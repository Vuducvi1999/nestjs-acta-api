import { Module } from '@nestjs/common';
import { CacheConfigService } from '../common/services/cache-config.service';
import { PrismaService } from '../common/services/prisma.service';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [CacheConfigService.register()],
  controllers: [StatisticsController],
  providers: [StatisticsService, PrismaService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
