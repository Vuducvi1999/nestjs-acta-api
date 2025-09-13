import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { CacheConfigService } from '../common/services/cache-config.service';
import { PrismaService } from '../common/services/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationModule } from '../notifications/notification.module';
import { PostController } from './posts.controller';
import { PostService } from './posts.service';
import { CommentsService } from './comments.service';
import { ReactionsService } from './reactions.service';
import { PostsGateway } from './posts.gateway';
import { PostCronService } from './cron.service';

@Module({
  imports: [
    CacheConfigService.register(),
    ScheduleModule.forRoot(),
    NotificationModule,
    HttpModule,
  ],
  controllers: [PostController],
  providers: [
    PostService,
    CommentsService,
    ReactionsService,
    PostsGateway,
    PrismaService,
    ActivityLogService,
    MailService,
    PostCronService,
  ],
  exports: [PostService, CommentsService, ReactionsService, PostsGateway],
})
export class PostModule {}
