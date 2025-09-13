import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationHelperService } from './notification-helper.service';
import { NotificationQueueService } from './notification-queue.service';
import { NotificationQueueController } from './notification-queue.controller';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificationController, NotificationQueueController],
  providers: [
    NotificationService,
    NotificationHelperService,
    NotificationQueueService,
    PrismaService,
  ],
  exports: [
    NotificationService,
    NotificationHelperService,
    NotificationQueueService,
  ],
})
export class NotificationModule {}
