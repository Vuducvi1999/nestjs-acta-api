# Module Integration Example

## KiotViet Integration Module Setup

Here's how to integrate the KiotViet sync controllers into your NestJS module:

### 1. Module Configuration

```typescript
// kiotviet-integration.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/services/prisma.module';

// Controllers
import { KiotVietProductSyncingController } from './controllers/syncing/kiotviet-product-syncing.controller';
import { KiotVietSyncLogsController } from './controllers/syncing/kiotviet-sync-logs.controller';

// Services
import { KiotVietSyncingService } from './services/kiotviet-syncing/kiotviet-syncing.product.service';
import { KiotVietSyncingHelpersService } from './services/kiotviet-syncing/kiotviet-syncing-helpers.service';
import { KiotVietSyncLogService } from './services/kiotviet-sync-log.service';
import { KiotVietProductUtil } from './utils/kiotviet-product.util';
import { KiotVietMappingService } from './services/kiotviet-mapping/kiotviet-mapping.product.service';
import { KiotVietProductService } from './services/kiot-viet.product.service';

@Module({
  imports: [
    PrismaModule, // For database access
  ],
  controllers: [KiotVietProductSyncingController, KiotVietSyncLogsController],
  providers: [
    // Core sync services
    KiotVietSyncingService,
    KiotVietSyncingHelpersService,
    KiotVietSyncLogService,

    // Utility services
    KiotVietProductUtil,
    KiotVietMappingService,
    KiotVietProductService,
  ],
  exports: [
    // Export services that might be used by other modules
    KiotVietSyncingService,
    KiotVietSyncLogService,
  ],
})
export class KiotVietIntegrationModule {}
```

### 2. App Module Integration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { KiotVietIntegrationModule } from './integrations/kiotviet/kiotviet-integration.module';

@Module({
  imports: [
    // ... other modules
    KiotVietIntegrationModule,
  ],
  // ... rest of app module configuration
})
export class AppModule {}
```

### 3. Guard and Authentication Setup

Make sure you have the JWT authentication guard configured:

```typescript
// auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### 4. Environment Configuration

Add required environment variables:

```env
# .env
DATABASE_URL="postgresql://username:password@localhost:5432/database"
KIOTVIET_API_KEY="your_kiotviet_api_key"
JWT_SECRET="your_jwt_secret"
```

### 5. Testing the Integration

Once the module is set up, you can test the endpoints:

#### Quick Health Check

```bash
curl http://localhost:3000/integrations/kiotviet/sync/health
```

#### Test Sync (with authentication)

```bash
curl -X POST http://localhost:3000/integrations/kiotviet/sync/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6. Database Migration

Ensure your database has the required tables. The sync logs table should be created by your Prisma schema:

```sql
-- This should be automatically created by Prisma migrations
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  start_time TIMESTAMP(3) NOT NULL,
  end_time TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
```

### 7. Service Dependencies

Make sure these services are properly configured:

#### PrismaService

```typescript
// common/services/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

#### JWT Strategy

```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return {
      id: payload.id,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      referenceId: payload.referenceId,
    };
  }
}
```

### 8. Error Handling Middleware

Optional: Add global error handling for better API responses:

```typescript
// common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: message,
    });
  }
}
```

### 9. Validation Pipes

Add validation for request parameters:

```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

### 10. Monitoring Setup

For production, consider adding monitoring:

```typescript
// monitoring/sync-monitoring.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KiotVietSyncLogService } from '../integrations/kiotviet/services/kiotviet-sync-log.service';

@Injectable()
export class SyncMonitoringService {
  private readonly logger = new Logger(SyncMonitoringService.name);

  constructor(private readonly syncLogService: KiotVietSyncLogService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStuckSyncs() {
    const stuckSyncs = await this.syncLogService.prisma.syncLog.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        },
      },
    });

    if (stuckSyncs.length > 0) {
      this.logger.warn(`Found ${stuckSyncs.length} stuck sync operations`);
      // Add alerting logic here
    }
  }
}
```

## Complete Directory Structure

```
src/
├── integrations/
│   └── kiotviet/
│       ├── controllers/
│       │   └── syncing/
│       │       ├── kiotviet-product-syncing.controller.ts
│       │       └── kiotviet-sync-logs.controller.ts
│       ├── services/
│       │   ├── kiotviet-syncing/
│       │   │   ├── kiotviet-syncing.product.service.ts
│       │   │   └── kiotviet-syncing-helpers.service.ts
│       │   ├── kiotviet-sync-log.service.ts
│       │   ├── kiotviet-mapping/
│       │   │   └── kiotviet-mapping.product.service.ts
│       │   └── kiot-viet.product.service.ts
│       ├── utils/
│       │   └── kiotviet-product.util.ts
│       ├── docs/
│       │   ├── PRODUCT_SYNC_GUIDE.md
│       │   ├── API_TESTING_GUIDE.md
│       │   └── SYNC_EXAMPLE.md
│       └── kiotviet-integration.module.ts
├── auth/
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── jwt-payload.ts
└── common/
    └── services/
        └── prisma.service.ts
```

This setup provides a complete, production-ready integration with proper error handling, authentication, and monitoring capabilities.
