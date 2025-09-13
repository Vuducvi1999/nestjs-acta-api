import { Module } from '@nestjs/common';
import { CacheConfigService } from '../common/services/cache-config.service';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { DocumentChapterUtil, DocumentUtil } from './document.util';
import { DocumentChapterController } from './document-chapter.controller';
import { DocumentChapterService } from './document-chapter.service';
import { DocumentUserController } from './document-user.controller';

@Module({
  imports: [CacheConfigService.register()],
  controllers: [
    DocumentController,
    DocumentChapterController,
    DocumentUserController,
  ],
  providers: [
    DocumentService,
    DocumentChapterService,
    PrismaService,
    ActivityLogService,
    DocumentUtil,
    DocumentChapterUtil,
  ],
  exports: [DocumentService],
})
export class DocumentModule {}
