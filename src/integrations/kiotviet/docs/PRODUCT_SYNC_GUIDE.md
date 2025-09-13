# KiotViet Product Sync Guide

## Overview

This guide explains the complete KiotViet product synchronization process that imports products from KiotViet API into the ACTA e-commerce system. The sync process includes creating related entities such as users, businesses, categories, warehouses, and products with their dependencies.

## Architecture

### Main Components

1. **KiotVietSyncingService** - Main orchestrator for the sync process
2. **KiotVietSyncingHelpersService** - Helper methods for entity creation
3. **KiotVietSyncLogService** - Sync logging and statistics tracking
4. **KiotVietProductUtil** - Utility functions for data generation
5. **KiotVietMappingService** - Data mapping from KiotViet to ACTA format

### Flow Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   KiotViet API  │───▶│  Mapping Service │───▶│ Syncing Service │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                ┌───────────────────────┼───────────────────────┐
                                │                       │                       │
                                ▼                       ▼                       ▼
                        ┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
                        │ Categories    │    │ Users/Businesses │    │ Warehouses      │
                        │ Creation      │    │ Creation         │    │ Creation        │
                        └───────────────┘    └──────────────────┘    └─────────────────┘
                                │                       │                       │
                                └───────────────────────┼───────────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │ Products        │
                                                │ Creation        │
                                                └─────────────────┘
```

## Sync Process

### 1. Initialization

The sync process starts with:

- **User Authentication**: Requires a valid JWT payload
- **Mapping Data**: Retrieves mapped products from KiotViet API
- **Sync Log Creation**: Creates initial sync log for tracking

### 2. Transaction-Based Processing

All operations are wrapped in a database transaction to ensure data consistency:

```typescript
await this.prisma.$transaction(
  async (tx) => {
    // All sync operations happen here
  },
  { timeout: 300000 },
); // 5-minute timeout
```

### 3. Entity Creation Order

The sync follows a specific order to maintain referential integrity:

1. **Categories** (Independent)
2. **Users** (For businesses)
3. **Businesses** (Depends on users)
4. **Warehouses** (Independent)
5. **Products** (Depends on categories, businesses, warehouses)

## Data Mapping

### Categories

KiotViet categories are mapped to ACTA categories with:

- **Source**: `OriginSource.kiotviet`
- **Group**: `CategoryGroup.c` (default)
- **Slug**: Auto-generated using `generateCategorySlug()`

### Users (Business Owners)

For each KiotViet trademark, a user is created with:

- **Email**: Generated using `generateBusinessEmail()`
- **Password**: Strong password using `generateBusinessPassword()`
- **Phone**: Generated Vietnamese phone number
- **Status**: `UserStatus.active` (pre-verified)
- **Role**: `Role.user`
- **Reference ID**: Auto-generated using profile count

### Businesses

KiotViet trademarks become businesses with:

- **Type**: `BusinessType.platform`
- **Source**: `OriginSource.kiotviet`
- **Slug**: Auto-generated using `generateBusinessSlug()`
- **Verified**: `true` (auto-verified)

### Warehouses

KiotViet branches become warehouses with:

- **Source**: `OriginSource.kiotviet`
- **Code**: Generated using `generateWarehouseCode()`
- **Address**: Auto-created with default values

### Products

KiotViet products are mapped with:

- **Barcode**: Generated using `generateBarcode()`
- **Slug**: Generated using `generateSlug()`
- **Type**: `ProductType.product`
- **Source**: `OriginSource.kiotviet`
- **Thumbnail**: First image or placeholder
- **Tax Type**: Mapped from KiotViet tax types

## Utility Functions

### Data Generation

The `KiotVietProductUtil` provides methods for generating:

- **Barcodes**: 13-digit format with product code + timestamp + random
- **Slugs**: URL-friendly slugs with normalization and uniqueness
- **Business Passwords**: Strong passwords with recognizable format
- **Business Emails**: Domain `@kiotviet-sync.local`
- **Phone Numbers**: Vietnamese format (090-099 prefixes)
- **Reference IDs**: Format `VN-{number}`

### Example Usage

```typescript
// Generate product slug
const slug = this.productUtil.generateSlug('Áo thun nam', 'SP001');
// Result: "ao-thun-nam-sp001-abc123"

// Generate business email
const email = this.productUtil.generateBusinessEmail('TM123', 'Nike Store');
// Result: "nikestore.tm123.xyz4@kiotviet-sync.local"

// Generate barcode
const barcode = this.productUtil.generateBarcode('SP001');
// Result: "SP01156789012" (13 digits)
```

## Sync Statistics

The sync process tracks detailed statistics:

### Stats Categories

- **Categories**: Adds, skips, errors
- **Users**: Adds, skips, errors
- **Businesses**: Adds, skips, errors
- **Warehouses**: Adds, skips, errors
- **Products**: Adds, updates, skips, conflicts, errors

### Sync Status Types

- **SUCCESS**: All operations completed successfully
- **FAILED**: Critical error occurred
- **PARTIAL**: Some operations failed but sync continued

## Error Handling

### Transaction Rollback

If any critical error occurs during the transaction, all changes are rolled back to maintain data integrity.

### Graceful Degradation

Non-critical errors are logged and tracked in statistics, but don't stop the sync process:

- Missing optional fields
- Image creation failures
- Attribute creation failures

### Conflict Resolution

- **Existing Records**: Skipped and counted in statistics
- **Missing Dependencies**: Marked as conflicts
- **Validation Errors**: Logged and counted as errors

## Configuration

### Default Values

```typescript
// User defaults
GENDER: Gender.not_known;
DOB: new Date(1990, 1, 1);
COUNTRY: 'VN';
AVATAR_URL: 'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b';

// Business defaults
TYPE: BusinessType.platform;
VERIFIED: true;
RESPONSE_TIME: '24h';
LOCATION: 'Việt Nam';

// Product defaults
TYPE: ProductType.product;
MIN_QUANTITY: 1;
UNIT: 'Cái';
CONVERSION_VALUE: 1;
```

### Timeouts

- **Transaction Timeout**: 300,000ms (5 minutes)
- **API Request Timeout**: Inherited from KiotViet service configuration

## Usage

### Basic Sync

```typescript
const result =
  await this.kiotVietSyncingService.syncKiotVietProductsToActa(user);

console.log(result);
// {
//   success: true,
//   syncLogId: "uuid-string",
//   details: { totalRecords: 100, successCount: 95, failedCount: 5, ... },
//   duration: 45000
// }
```

### Sync Log Monitoring

```typescript
// Get latest sync log
const latestLog = await this.syncLogService.getLatestSyncLog(
  SyncEntityType.PRODUCT,
  SyncDirection.KIOTVIET_TO_ACTA,
);

// Get sync history
const logs = await this.syncLogService.getSyncLogs(
  SyncEntityType.PRODUCT,
  SyncDirection.KIOTVIET_TO_ACTA,
  10, // limit
);
```

## Performance Considerations

### Batch Processing

- Categories, users, businesses, and warehouses are processed sequentially
- Products are processed one by one with related data creation
- Large datasets may require chunking for better performance

### Memory Usage

- Transaction keeps all operations in memory until commit
- Large product catalogs may require memory monitoring
- Consider implementing batch processing for very large datasets

### Database Connections

- Single transaction reduces connection overhead
- Long-running transactions may impact other operations
- Monitor database connection pool usage

## Troubleshooting

### Common Issues

1. **Transaction Timeout**

   - Increase timeout value
   - Implement batch processing
   - Optimize database queries

2. **Duplicate Key Errors**

   - Check unique constraints
   - Verify slug generation uniqueness
   - Review existing data cleanup

3. **Missing Dependencies**

   - Verify mapping service data integrity
   - Check KiotViet API response completeness
   - Review foreign key constraints

4. **Memory Issues**
   - Implement streaming for large datasets
   - Add memory monitoring
   - Consider pagination

### Debug Mode

Enable detailed logging:

```typescript
// Set log level to debug
private readonly logger = new Logger(KiotVietSyncingService.name);
```

### Health Checks

Monitor sync health:

```typescript
// Check sync service health
const health = await this.syncLogService.getLatestSyncLog(
  SyncEntityType.PRODUCT,
  SyncDirection.KIOTVIET_TO_ACTA,
);

if (health?.status === SyncStatus.FAILED) {
  // Handle failed sync
}
```

## Security Considerations

### Generated Credentials

- Business user passwords are strong but predictable
- Emails use non-routable domain `@kiotviet-sync.local`
- Phone numbers are generated, not real
- All generated data should be updated with real data post-sync

### Data Privacy

- KiotViet API data is processed according to integration agreement
- Generated dummy data doesn't contain real personal information
- Sync logs may contain business-sensitive information

## Future Enhancements

### Planned Features

1. **Incremental Sync**: Only sync changed data
2. **Bidirectional Sync**: Sync changes back to KiotViet
3. **Conflict Resolution**: Advanced handling of data conflicts
4. **Real-time Sync**: Webhook-based sync triggers
5. **Performance Optimization**: Batch processing and caching

### Extension Points

1. **Custom Mapping**: Allow custom field mappings
2. **Validation Rules**: Configurable validation logic
3. **Transformation Hooks**: Pre/post-processing hooks
4. **Event Triggers**: Integration with event system

## API Reference

### Main Methods

#### `syncKiotVietProductsToActa(user: JwtPayload)`

Performs complete product synchronization from KiotViet to ACTA.

**Parameters:**

- `user`: JWT payload with user authentication

**Returns:**

```typescript
{
  success: boolean;
  syncLogId: string;
  details: SyncLogDetails;
  duration: number;
}
```

**Throws:**

- Database transaction errors
- KiotViet API errors
- Validation errors

#### Utility Methods

See `KiotVietProductUtil` class for complete utility method documentation.

## Support

For issues or questions:

1. Check sync logs for detailed error information
2. Review this documentation
3. Contact the integration team
4. Check KiotViet API status and documentation

---

_Last updated: 2025_
_Version: 1.0_
