import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { AddressModule } from '../address/address.module';
import { AttachmentModule } from '../attachments/attachment.module';
import { AttachmentService } from '../attachments/attachment.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaService } from '../common/services/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationModule } from '../notifications/notification.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { UserConfigController } from './users-config.controller';
import { UserConfigService } from './users-config.service';
import { UserController } from './controllers/user.controller';
import { UserActionService } from './services/user-action.service';
import { UserKYCCronService } from './services/user-kyc-cron.service';
import { KYCCronController } from './controllers/kyc-cron.controller';
import { UserProfileService } from './services/user-profile.service';
import { UserReferralService } from './services/user-referral.service';
import { UserSearchService } from './services/user-search.service';
import { UserStatisticsService } from './services/user-statistics.service';
import { UserService } from './services/user.service';
import { AvatarPostService } from './services/avatar-post.service';
import { PostService } from '../posts/posts.service';
import { UserCacheUtil } from './utils/user-cache.util';
import { UsersGateway } from './users.gateway';
import { SocketEmitterService } from './services/socket-emitter.service';

@Module({
  imports: [
    CloudinaryModule,
    AttachmentModule,
    AddressModule,
    NotificationModule,
    ScheduleModule.forRoot(),
    CacheModule.register(),
    ConfigModule,
    HttpModule,
  ],
  providers: [
    UserService,
    UserProfileService,
    UserReferralService,
    UserStatisticsService,
    UserActionService,
    UserSearchService,
    UserConfigService,
    UserKYCCronService,
    AvatarPostService,
    PostService,
    UserCacheUtil,
    PrismaService,
    AttachmentService,
    MailService,
    ActivityLogService,
    UsersGateway,
    SocketEmitterService,
  ],
  exports: [UserService, UserKYCCronService, UsersGateway],
  controllers: [UserController, UserConfigController, KYCCronController],
})
export class UserModule {}
