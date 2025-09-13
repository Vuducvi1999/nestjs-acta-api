import {
  INestApplication,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private static instance: PrismaService;
  private connectionCount = 0;
  private readonly maxConnections = parseInt(
    process.env.DATABASE_MAX_CONNECTIONS || '10',
  );

  constructor() {
    super({
      log: ['error', 'warn'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Add error handling for connection issues
      errorFormat: 'pretty',
    });

    // Singleton pattern to ensure only one instance
    if (PrismaService.instance) {
      return PrismaService.instance;
    }
    PrismaService.instance = this;
  }

  async onModuleInit() {
    try {
      // Check current connection count
      if (this.connectionCount >= this.maxConnections) {
        console.warn(
          `Maximum connections (${this.maxConnections}) reached, waiting for available connection...`,
        );
        await this.waitForAvailableConnection();
      }

      await this.$connect();
      this.connectionCount++;
      console.log(
        `Database connected successfully. Active connections: ${this.connectionCount}`,
      );

      // Test the connection
      await this.$queryRaw`SELECT 1`;
      console.log('Database connection test successful');
    } catch (error) {
      console.error('Failed to connect to database:', error);
      this.connectionCount = Math.max(0, this.connectionCount - 1);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    console.log(
      `Database disconnected. Active connections: ${this.connectionCount}`,
    );
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await this.cleanup();
      await app.close();
    });

    process.on('SIGINT', async () => {
      await this.cleanup();
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      await app.close();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught Exception:', error);
      await this.cleanup();
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      await this.cleanup();
      process.exit(1);
    });
  }

  private async waitForAvailableConnection(): Promise<void> {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.connectionCount < this.maxConnections) {
          resolve();
        } else {
          setTimeout(checkConnection, 1000); // Wait 1 second before checking again
        }
      };
      checkConnection();
    });
  }

  private async cleanup(): Promise<void> {
    try {
      await this.$disconnect();
      this.connectionCount = 0;
      console.log('Database cleanup completed');
    } catch (error) {
      console.error('Error during database cleanup:', error);
    }
  }

  // Health check method
  async healthCheck() {
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        connections: this.connectionCount,
        maxConnections: this.maxConnections,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connections: this.connectionCount,
        maxConnections: this.maxConnections,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Method to get connection status
  getConnectionStatus() {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      availableConnections: this.maxConnections - this.connectionCount,
    };
  }
}
