import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { NotificationQueueService } from './notification-queue.service';

@ApiTags('Notification Queue')
@Controller('notification-queue')
@UseGuards(RolesGuard)
export class NotificationQueueController {
  constructor(
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get notification queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  async getQueueStats() {
    return this.notificationQueueService.getQueueStats();
  }

  @Post('clear')
  @ApiOperation({ summary: 'Clear all pending notifications in queue' })
  @ApiResponse({ status: 200, description: 'Queue cleared successfully' })
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  async clearQueue() {
    return this.notificationQueueService.clearQueue();
  }

  @Post('retry/:itemId')
  @ApiOperation({ summary: 'Retry processing a specific notification item' })
  @ApiResponse({ status: 200, description: 'Item retried successfully' })
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  async retryItem(@Param('itemId') itemId: string) {
    return this.notificationQueueService.retryItem(itemId);
  }
}
