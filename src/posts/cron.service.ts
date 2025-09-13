import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { MailService } from '../mail/mail.service';
import { Role } from '@prisma/client';

@Injectable()
export class PostCronService {
  private readonly logger = new Logger(PostCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleUnpublishedPostsNotification() {
    this.logger.log('Starting check for unpublished posts...');

    try {
      // Count unpublished posts - much faster than fetching all data
      const unpublishedPostsCount = await this.prisma.post.count({
        where: {
          isPublished: false,
          publishedAt: null,
          deletedAt: null,
        },
      });

      this.logger.log(`Found ${unpublishedPostsCount} unpublished posts`);

      if (unpublishedPostsCount > 0) {
        await this.notificationApprovePost(unpublishedPostsCount);
      }
    } catch (error) {
      this.logger.error('Error in unpublished posts check:', error);
    }
  }

  private async notificationApprovePost(unpublishedPostsCount: number) {
    this.logger.log(
      `Sending notifications for ${unpublishedPostsCount} unpublished posts to all admins`,
    );

    try {
      // Get all active admin users
      const adminUsers = await this.prisma.user.findMany({
        where: {
          role: Role.admin,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      });

      const filteredAdminUsers = adminUsers.filter(
        (user) => user.email !== 'thongprofessor@gmail.com',
      );

      if (filteredAdminUsers.length === 0) {
        this.logger.warn(
          'No active admin users found to send notifications to',
        );
        return;
      }

      const urlLink = `${process.env.FRONTEND_DOMAIN}/admin/posts/socials`;
      const batchResult =
        await this.mailService.sendUnpublishedPostNotificationBatch(
          filteredAdminUsers,
          unpublishedPostsCount.toString(),
          urlLink,
        );

      this.logger.log(
        `Batch email result: ${batchResult.success} successful, ${batchResult.failed} failed`,
      );

      if (batchResult.failed > 0) {
        this.logger.warn(`Failed emails: ${batchResult.errors.join(', ')}`);
      }

      this.logger.log(
        `Notification sent for ${unpublishedPostsCount} unpublished posts to ${adminUsers.length} admin users`,
      );
    } catch (error) {
      this.logger.error(`Failed to send notifications to admins:`, error);
    }
  }
}
