import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationAction, RelatedModel } from '@prisma/client';

export interface CreateNotificationDto {
  userId: string;
  relatedModel: RelatedModel;
  relatedModelId: string;
  action: NotificationAction;
  message: string;
  linkUrl?: string; // Optional URL for navigation
}

export interface UpdateNotificationDto {
  isRead?: boolean;
  message?: string;
}

export interface NotificationQuery {
  userId?: string;
  relatedModel?: RelatedModel;
  action?: NotificationAction;
  isRead?: boolean;
  page?: number | string;
  limit?: number | string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateLinkUrl(
    relatedModel: RelatedModel,
    relatedModelId: string,
    action: NotificationAction,
  ): string {
    switch (relatedModel) {
      case RelatedModel.user:
        switch (action) {
          case NotificationAction.kyc_submitted:
            return `/admin/users?userId=${relatedModelId}`;
          case NotificationAction.approved:
            return '';
          case NotificationAction.kyc_approved:
            return ''; // No navigation for KYC approval notifications
          case NotificationAction.kyc_changing:
            return `/kyc`;
          case NotificationAction.direct_referral_verified:
            return ''; // No navigation for referral verification notifications
          case NotificationAction.direct_referral_registered:
            return ''; // No navigation for direct referral registered
          case NotificationAction.indirect_referral_registered:
            return ''; // No navigation for indirect referral registered
          default:
            return `/admin/users?userId=${relatedModelId}`;
        }
      case RelatedModel.post:
        return `/posts/${relatedModelId}`;
      case RelatedModel.document:
        return `/documents/${relatedModelId}`;
      case RelatedModel.news_item:
        return `/news/${relatedModelId}`;
      case RelatedModel.comment:
        return `/comments/${relatedModelId}`;
      case RelatedModel.system:
        return `/admin/system`;
      default:
        return '/';
    }
  }

  async createNotification(data: CreateNotificationDto) {
    try {
      // Generate linkUrl if not provided (for future use after migration)
      const linkUrl =
        data.linkUrl !== undefined
          ? data.linkUrl
          : this.generateLinkUrl(
              data.relatedModel,
              data.relatedModelId,
              data.action,
            );

      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          relatedModel: data.relatedModel,
          relatedModelId: data.relatedModelId,
          action: data.action,
          message: data.message,
          linkUrl: linkUrl,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: {
                select: {
                  id: true,
                  fileUrl: true,
                },
              },
            },
          },
        },
      });

      // Add linkUrl to the response for frontend use
      const notificationWithLink = {
        ...notification,
        linkUrl: linkUrl,
      };

      this.logger.log(
        `Notification created for user ${data.userId} with linkUrl: ${linkUrl}`,
      );

      // Note: Socket events are now handled by the calling service
      // This method only creates the notification in the database

      return notificationWithLink;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`);
      throw error;
    }
  }

  async getNotifications(query: NotificationQuery = {}) {
    const { page = 1, limit = 10, ...whereClause } = query;
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (whereClause.userId) where.userId = whereClause.userId;
    if (whereClause.relatedModel) where.relatedModel = whereClause.relatedModel;
    if (whereClause.action) where.action = whereClause.action;
    if (whereClause.isRead !== undefined) where.isRead = whereClause.isRead;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              avatar: {
                select: {
                  id: true,
                  fileUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      this.prisma.notification.count({ where }),
    ]);

    // Add linkUrl to each notification
    const notificationsWithLinks = notifications.map((notification) => ({
      ...notification,
      linkUrl:
        (notification as any).linkUrl !== undefined
          ? (notification as any).linkUrl
          : this.generateLinkUrl(
              notification.relatedModel,
              notification.relatedModelId,
              notification.action,
            ),
    }));

    return {
      data: notificationsWithLinks,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1,
    };
  }

  async getNotificationById(id: string) {
    return this.prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
          },
        },
      },
    });
  }

  async updateNotification(id: string, data: UpdateNotificationDto) {
    this.logger.log(`Attempting to update notification ${id} with data:`, data);

    // First check if notification exists
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      this.logger.error(`Notification with id ${id} not found for update`);
      throw new Error(`Notification with id ${id} not found`);
    }

    this.logger.log(
      `Found notification: ${notification.id} for user: ${notification.userId}`,
    );

    const result = await this.prisma.notification.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatar: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Successfully updated notification ${id}`);
    return result;
  }

  async markAsRead(id: string) {
    this.logger.log(`Attempting to mark notification ${id} as read`);

    // First check if notification exists
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      this.logger.error(`Notification with id ${id} not found`);
      throw new Error(`Notification with id ${id} not found`);
    }

    this.logger.log(
      `Found notification: ${notification.id} for user: ${notification.userId}`,
    );

    const result = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    this.logger.log(`Successfully marked notification ${id} as read`);
    return result;
  }

  async markAllAsRead(userId: string) {
    this.logger.log(
      `Attempting to mark all notifications as read for user: ${userId}`,
    );

    // First check if user has any unread notifications
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    this.logger.log(
      `Found ${unreadCount} unread notifications for user: ${userId}`,
    );

    if (unreadCount === 0) {
      this.logger.log(`No unread notifications found for user: ${userId}`);
      return { updatedCount: 0, message: 'No unread notifications to mark' };
    }

    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    this.logger.log(
      `Successfully marked ${result.count} notifications as read for user: ${userId}`,
    );
    return {
      updatedCount: result.count,
      message: `Marked ${result.count} notifications as read`,
    };
  }

  async deleteNotification(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async getNotificationStats(userId: string) {
    const [total, unread] = await Promise.all([
      this.prisma.notification.count({
        where: { userId },
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      total,
      unread,
      read: total - unread,
    };
  }
}
