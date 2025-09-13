import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { CacheConfigService } from '../common/services/cache-config.service';
import { PrismaService } from '../common/services/prisma.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { MessagesSocketEmitterService } from './services/messages-socket-emitter.service';

@Module({
  imports: [CacheConfigService.register(), ScheduleModule.forRoot()],
  controllers: [MessagesController],
  providers: [PrismaService, ActivityLogService, MessagesService, MessagesGateway, MessagesSocketEmitterService],
  exports: [],
})
export class MessagesModule {}
