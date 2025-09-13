# KiotViet Product Sync Example

## Usage Example

Here's how to use the KiotViet product synchronization service:

### 1. Basic Usage

```typescript
import { KiotVietSyncingService } from './services/kiotviet-syncing/kiotviet-syncing.product.service';
import { JwtPayload } from '../../../auth/jwt-payload';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncingService: KiotVietSyncingService) {}

  @Post('kiotviet-products')
  @UseGuards(JwtAuthGuard)
  async syncProducts(@Request() req) {
    const user: JwtPayload = req.user;

    try {
      const result = await this.syncingService.syncKiotVietProductsToActa(user);

      return {
        success: true,
        message: 'Products synchronized successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Sync failed',
        error: error.message,
      };
    }
  }
}
```

### 2. Expected Response

```json
{
  "success": true,
  "message": "Products synchronized successfully",
  "data": {
    "success": true,
    "syncLogId": "clx1234567890abcdef",
    "details": {
      "totalRecords": 150,
      "successCount": 145,
      "failedCount": 5,
      "errorDetails": [
        "Product SP001: Missing category information",
        "Product SP002: Invalid trademark data"
      ],
      "categoryStats": {
        "adds": 12,
        "updates": 0,
        "skips": 3,
        "conflicts": 0,
        "errors": 0
      },
      "businessStats": {
        "adds": 8,
        "updates": 0,
        "skips": 2,
        "conflicts": 0,
        "errors": 0
      },
      "warehouseStats": {
        "adds": 5,
        "updates": 0,
        "skips": 1,
        "conflicts": 0,
        "errors": 0
      },
      "userStats": {
        "adds": 8,
        "updates": 0,
        "skips": 2,
        "conflicts": 0,
        "errors": 0
      },
      "productStats": {
        "adds": 145,
        "updates": 0,
        "skips": 0,
        "conflicts": 3,
        "errors": 2
      }
    },
    "duration": 45230
  }
}
```

### 3. Module Configuration

Make sure to include all required services in your module:

```typescript
import { Module } from '@nestjs/common';
import { KiotVietSyncingService } from './services/kiotviet-syncing/kiotviet-syncing.product.service';
import { KiotVietSyncingHelpersService } from './services/kiotviet-syncing/kiotviet-syncing-helpers.service';
import { KiotVietSyncLogService } from './services/kiotviet-sync-log.service';
import { KiotVietProductUtil } from './utils/kiotviet-product.util';
import { KiotVietMappingService } from './services/kiotviet-mapping/kiotviet-mapping.product.service';
import { KiotVietProductService } from './services/kiot-viet.product.service';

@Module({
  providers: [
    KiotVietSyncingService,
    KiotVietSyncingHelpersService,
    KiotVietSyncLogService,
    KiotVietProductUtil,
    KiotVietMappingService,
    KiotVietProductService,
  ],
  exports: [KiotVietSyncingService],
})
export class KiotVietIntegrationModule {}
```

### 4. Error Handling

```typescript
try {
  const result = await this.syncingService.syncKiotVietProductsToActa(user);

  if (result.details.failedCount > 0) {
    console.warn(`Sync completed with ${result.details.failedCount} failures`);
    console.warn('Error details:', result.details.errorDetails);
  }

  return result;
} catch (error) {
  if (error.code === 'P2002') {
    // Unique constraint violation
    console.error('Duplicate data error:', error);
  } else if (error.code === 'P2025') {
    // Record not found
    console.error('Required data not found:', error);
  } else {
    console.error('Unexpected sync error:', error);
  }

  throw error;
}
```

### 5. Monitoring Sync Progress

```typescript
// Get sync history
const recentSyncs = await this.syncLogService.getSyncLogs(
  SyncEntityType.PRODUCT,
  SyncDirection.KIOTVIET_TO_ACTA,
  10,
);

// Check latest sync status
const latestSync = await this.syncLogService.getLatestSyncLog(
  SyncEntityType.PRODUCT,
  SyncDirection.KIOTVIET_TO_ACTA,
);

if (latestSync?.status === SyncStatus.FAILED) {
  console.error('Last sync failed:', latestSync.details);
}
```

### 6. Generated Data Examples

After sync, you'll have:

#### Users (Business Owners)

```typescript
{
  email: "nikestore.kvtm123.xyz4@kiotviet-sync.local",
  fullName: "Nike Store",
  phoneNumber: "0903456789",
  referenceId: "vn-11045",
  status: "active",
  role: "user",
  verificationDate: "2025-01-16T10:00:00Z"
}
```

#### Businesses

```typescript
{
  kiotVietTradeMarkId: 123,
  code: "KVTM-123",
  name: "Nike Store",
  slug: "nike-store-123-abc4",
  type: "platform",
  verified: true,
  isActive: true,
  source: "kiotviet"
}
```

#### Categories

```typescript
{
  kiotVietCategoryId: 456,
  name: "Giày thể thao",
  slug: "giay-the-thao-456-def5",
  group: "c",
  source: "kiotviet",
  isActive: true
}
```

#### Products

```typescript
{
  kiotVietProductId: 789,
  code: "SP001",
  name: "Giày Nike Air Max",
  slug: "giay-nike-air-max-sp001-ghi6",
  barCode: "SP01987654321",
  type: "product",
  source: "kiotviet",
  isActive: true,
  allowsSale: true
}
```

### 7. Best Practices

1. **Run during low-traffic hours** to minimize impact
2. **Monitor memory usage** for large catalogs
3. **Check sync logs** after each run
4. **Update generated credentials** with real data
5. **Test with small datasets** first
6. **Have rollback plan** ready

### 8. Troubleshooting Common Issues

#### Transaction Timeout

```typescript
// If you get transaction timeout errors
await this.prisma.$transaction(
  async (tx) => {
    // ... sync operations
  },
  {
    timeout: 600000, // Increase to 10 minutes
    maxWait: 10000,
    isolationLevel: 'ReadCommitted',
  },
);
```

#### Unique Constraint Violations

```typescript
// Check for existing data before sync
const existingProductsCount = await this.prisma.product.count({
  where: {
    source: OriginSource.kiotviet,
  },
});

if (existingProductsCount > 0) {
  console.warn(`Found ${existingProductsCount} existing KiotViet products`);
}
```

#### Memory Issues

```typescript
// For large datasets, consider chunking
const CHUNK_SIZE = 100;
const chunks = this.chunkArray(mappedProducts, CHUNK_SIZE);

for (const chunk of chunks) {
  await this.processProductChunk(chunk);
  // Allow garbage collection between chunks
  await new Promise((resolve) => setTimeout(resolve, 100));
}
```

---

This example demonstrates the complete usage of the KiotViet product synchronization system.
