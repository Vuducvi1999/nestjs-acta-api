import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';

@ApiBearerAuth()
@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Query() query: any, @Request() req: any) {
    const userId = req.user.id;
    return this.notificationService.getNotifications({
      ...query,
      userId,
    });
  }

  @Get('stats')
  async getNotificationStats(@Request() req: any) {
    const userId = req.user.id;
    return this.notificationService.getNotificationStats(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user.id;
    const count = await this.notificationService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  @Get(':id')
  async getNotificationById(@Param('id') id: string) {
    return this.notificationService.getNotificationById(id);
  }

  @Post()
  async createNotification(@Body() data: any) {
    return this.notificationService.createNotification(data);
  }

  @Put('mark-all-read')
  async markAllAsRead(@Request() req: any) {
    console.log(`PUT /notifications/mark-all-read called`);
    console.log(`Request user:`, req.user);
    console.log(`User ID:`, req.user?.id);

    if (!req.user?.id) {
      throw new Error('User ID not found in request');
    }

    try {
      const userId = req.user.id;
      const result = await this.notificationService.markAllAsRead(userId);
      console.log(`Mark all as read result:`, result);
      return result;
    } catch (error) {
      console.error(
        `Failed to mark all notifications as read for user ${req.user.id}:`,
        error,
      );
      throw new Error(
        `Failed to mark all notifications as read: ${error.message}`,
      );
    }
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    console.log(`PUT /notifications/${id}/read called`);
    try {
      return await this.notificationService.markAsRead(id);
    } catch (error) {
      console.error(`Failed to mark notification ${id} as read:`, error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  @Put(':id')
  async updateNotification(@Param('id') id: string, @Body() data: any) {
    console.log(`PUT /notifications/${id} called with data:`, data);
    try {
      return await this.notificationService.updateNotification(id, data);
    } catch (error) {
      console.error(`Failed to update notification ${id}:`, error);
      throw new Error(`Failed to update notification: ${error.message}`);
    }
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: string) {
    return this.notificationService.deleteNotification(id);
  }
}
