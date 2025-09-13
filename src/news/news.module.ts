import { Module } from '@nestjs/common';
import { NewsController } from '../news/news.controller';
import { NewsService } from '../news/news.service';
import { PrismaService } from '../common/services/prisma.service';
import { CacheConfigService } from '../common/services/cache-config.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
@Module({
  imports: [CacheConfigService.register()],
  controllers: [NewsController],
  providers: [NewsService, PrismaService, ActivityLogService],
  exports: [NewsService],
})
export class NewsModule {}
