import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationAction, RelatedModel } from '@prisma/client';

interface NotificationQueueItem {
  id: string;
  userId: string;
  relatedModel: RelatedModel;
  relatedModelId: string;
  action: NotificationAction;
  message: string;
  linkUrl?: string;
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly queue: NotificationQueueItem[] = [];
  private readonly processing = new Set<string>();
  private readonly batchSize = 10; // Xử lý 10 notifications mỗi batch
  private readonly processingInterval = 1000; // Xử lý mỗi 1 giây

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    this.startProcessing();
  }

  /**
   * Thêm notification vào queue
   */
  async addToQueue(
    userId: string,
    relatedModel: RelatedModel,
    relatedModelId: string,
    action: NotificationAction,
    message: string,
    linkUrl?: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): Promise<void> {
    const queueItem: NotificationQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      relatedModel,
      relatedModelId,
      action,
      message,
      linkUrl,
      priority,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    // Thêm vào queue theo priority
    if (priority === 'high') {
      this.queue.unshift(queueItem); // Thêm vào đầu
    } else {
      this.queue.push(queueItem); // Thêm vào cuối
    }

    this.logger.log(
      `Added notification to queue: ${action} for user ${userId} (Priority: ${priority})`,
    );
  }

  /**
   * Xử lý queue trong background
   */
  private startProcessing(): void {
    setInterval(async () => {
      if (this.queue.length === 0 || this.processing.size >= this.batchSize) {
        return;
      }

      // Lấy batch notifications để xử lý
      const batch = this.queue.splice(0, this.batchSize);

      for (const item of batch) {
        if (this.processing.has(item.id)) continue;

        this.processing.add(item.id);
        this.processNotificationItem(item).finally(() => {
          this.processing.delete(item.id);
        });
      }
    }, this.processingInterval);
  }

  /**
   * Xử lý từng notification item
   */
  private async processNotificationItem(
    item: NotificationQueueItem,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing notification: ${item.action} for user ${item.userId}`,
      );

      // Tạo notification
      await this.notificationService.createNotification({
        userId: item.userId,
        relatedModel: item.relatedModel,
        relatedModelId: item.relatedModelId,
        action: item.action,
        message: item.message,
        linkUrl: item.linkUrl,
      });

      this.logger.log(
        `Notification processed successfully: ${item.action} for user ${item.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process notification ${item.id}: ${error.message}`,
      );

      // Retry logic
      if (item.retryCount < item.maxRetries) {
        item.retryCount++;
        item.createdAt = new Date();

        // Thêm lại vào queue với delay
        setTimeout(
          () => {
            if (item.priority === 'high') {
              this.queue.unshift(item);
            } else {
              this.queue.push(item);
            }
          },
          Math.pow(2, item.retryCount) * 1000,
        ); // Exponential backoff
      } else {
        this.logger.error(
          `Notification ${item.id} failed after ${item.maxRetries} retries`,
        );
      }
    }
  }

  /**
   * Lấy thống kê queue
   */
  getQueueStats(): {
    total: number;
    processing: number;
    highPriority: number;
    normalPriority: number;
    lowPriority: number;
  } {
    const highPriority = this.queue.filter(
      (item) => item.priority === 'high',
    ).length;
    const normalPriority = this.queue.filter(
      (item) => item.priority === 'normal',
    ).length;
    const lowPriority = this.queue.filter(
      (item) => item.priority === 'low',
    ).length;

    return {
      total: this.queue.length,
      processing: this.processing.size,
      highPriority,
      normalPriority,
      lowPriority,
    };
  }

  /**
   * Cleanup old items (cron job)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldItems(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldItems = this.queue.filter((item) => item.createdAt < oneHourAgo);

    if (oldItems.length > 0) {
      this.queue.splice(0, oldItems.length);
      this.logger.log(`Cleaned up ${oldItems.length} old notification items`);
    }
  }

  /**
   * Clear all pending notifications in queue
   */
  async clearQueue(): Promise<{ message: string; clearedCount: number }> {
    const clearedCount = this.queue.length;
    this.queue.splice(0, this.queue.length);
    this.logger.log(`Cleared ${clearedCount} pending notifications from queue`);
    return { message: 'Queue cleared successfully', clearedCount };
  }

  /**
   * Retry processing a specific notification item
   */
  async retryItem(
    itemId: string,
  ): Promise<{ message: string; success: boolean }> {
    const item = this.queue.find((q) => q.id === itemId);
    if (!item) {
      return { message: `Item ${itemId} not found in queue`, success: false };
    }

    // Remove from queue and add back to front (high priority)
    const index = this.queue.findIndex((q) => q.id === itemId);
    if (index > -1) {
      this.queue.splice(index, 1);
    }

    item.retryCount = 0;
    item.createdAt = new Date();
    this.queue.unshift(item);

    this.logger.log(`Retried item ${itemId}`);
    return { message: `Item ${itemId} retried successfully`, success: true };
  }
}
