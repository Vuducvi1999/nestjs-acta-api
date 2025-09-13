import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';
import { PaginatedActivityLogResponseDto } from '../activity-logs/dto/activity-log-response.dto';
import { ActivityLogQueryDto } from '../activity-logs/dto/activity-log-query.dto';
import { ActivityLogService } from '../activity-logs/activity-log.service';

@ApiBearerAuth()
@ApiTags('Analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Get('business-metrics')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get business metrics for admin dashboard',
    description:
      'Returns comprehensive business metrics including user growth, content creation, and engagement statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Business metrics retrieved successfully',
    type: AnalyticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async getBusinessMetrics(
    @Query() query: AnalyticsQueryDto,
  ): Promise<AnalyticsResponseDto> {
    return this.analyticsService.getBusinessMetrics(query);
  }

  @Get('activity-logs')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get activity logs for admin dashboard',
    description: 'Returns activity logs for admin dashboard',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Activity logs retrieved successfully',
    type: PaginatedActivityLogResponseDto,
  })
  async getActivityLogs(
    @Query() query: ActivityLogQueryDto,
  ): Promise<PaginatedActivityLogResponseDto> {
    return this.activityLogService.findAll(query);
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Check analytics service health',
    description: 'Returns health status of the analytics service',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Analytics service is healthy',
  })
  async getHealth(): Promise<{ status: string; timestamp: Date }> {
    return {
      status: 'healthy',
      timestamp: new Date(),
    };
  }

  @Post('activity-logs/cleanup')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Clean up orphaned activity logs',
    description: 'Removes activity logs with invalid uploader references',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cleanup completed successfully',
  })
  async cleanupActivityLogs(): Promise<{ deleted: number; message: string }> {
    const result = await this.activityLogService.cleanupOrphanedActivityLogs();
    return {
      deleted: result.deleted,
      message: `Successfully deleted ${result.deleted} orphaned activity logs`,
    };
  }
}
