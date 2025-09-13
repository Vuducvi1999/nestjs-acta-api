import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from './common/services/prisma.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  @ApiResponse({ status: 503, description: 'Application is unhealthy' })
  async getHealth() {
    const dbHealth = await this.prismaService.healthCheck();
    const connectionStatus = this.prismaService.getConnectionStatus();

    const isHealthy = dbHealth.status === 'healthy';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      connections: connectionStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }

  @Get('health/db')
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  async getDatabaseHealth() {
    return await this.prismaService.healthCheck();
  }

  @Get('health/connections')
  @ApiOperation({ summary: 'Database connection status' })
  @ApiResponse({ status: 200, description: 'Connection status retrieved' })
  async getConnectionStatus() {
    return this.prismaService.getConnectionStatus();
  }
}
