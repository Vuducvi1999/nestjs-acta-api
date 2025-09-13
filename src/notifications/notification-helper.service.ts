import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationAction, RelatedModel } from '@prisma/client';

@Injectable()
export class NotificationHelperService {
  private readonly logger = new Logger(NotificationHelperService.name);

  constructor(private readonly notificationService: NotificationService) {}

  async createPostNotification(
    userId: string,
    postId: string,
    action: NotificationAction,
    message: string,
  ) {
    return this.notificationService.createNotification({
      userId,
      relatedModel: RelatedModel.post,
      relatedModelId: postId,
      action,
      message,
    });
  }

  async createNewsNotification(
    userId: string,
    newsId: string,
    action: NotificationAction,
    message: string,
  ) {
    return this.notificationService.createNotification({
      userId,
      relatedModel: RelatedModel.news_item,
      relatedModelId: newsId,
      action,
      message,
    });
  }

  async createDocumentNotification(
    userId: string,
    documentId: string,
    action: NotificationAction,
    message: string,
  ) {
    return this.notificationService.createNotification({
      userId,
      relatedModel: RelatedModel.document,
      relatedModelId: documentId,
      action,
      message,
    });
  }

  async createUserNotification(
    userId: string,
    targetUserId: string,
    action: NotificationAction,
    message: string,
  ) {
    return this.notificationService.createNotification({
      userId,
      relatedModel: RelatedModel.user,
      relatedModelId: targetUserId,
      action,
      message,
    });
  }

  async createCommentNotification(
    userId: string,
    commentId: string,
    action: NotificationAction,
    message: string,
  ) {
    return this.notificationService.createNotification({
      userId,
      relatedModel: RelatedModel.comment,
      relatedModelId: commentId,
      action,
      message,
    });
  }

  async createSystemNotification(
    userId: string,
    action: NotificationAction,
    message: string,
  ) {
    return this.notificationService.createNotification({
      userId,
      relatedModel: RelatedModel.system,
      relatedModelId: 'system',
      action,
      message,
    });
  }

  async createBatchNotifications(
    userIds: string[],
    relatedModel: RelatedModel,
    relatedModelId: string,
    action: NotificationAction,
    message: string,
  ) {
    const notifications = userIds.map((userId) =>
      this.notificationService.createNotification({
        userId,
        relatedModel,
        relatedModelId,
        action,
        message,
      }),
    );

    return Promise.all(notifications);
  }
}
