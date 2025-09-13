# KiotViet Product Syncing - Refactored Structure

## Overview

This directory contains the refactored KiotViet product synchronization services, organized into smaller, more maintainable modules for better separation of concerns and code reusability.

## Structure

```
products/
├── README.md                                    # This documentation
├── index.ts                                     # Main exports
├── kiotviet-product-sync.service.ts            # Main orchestrator service (NEW)
├── kiotviet-product-mapping.helper.ts          # Data transformation helper (NEW)
├── kiotviet-product-relationships.helper.ts    # Relationship syncing helper (NEW)
├── kiotviet-warehouse.helper.ts                # Warehouse management helper (NEW)
├── kiotviet-product-crud.service.ts            # CRUD operations (MOVED)
└── kiotviet-syncing.product.service.ts         # Legacy service (MOVED)
```

## Services and Helpers

### 1. KiotVietProductSyncService (Main Orchestrator)

**Purpose**: Main service that orchestrates the entire product synchronization process.

**Key Responsibilities**:

- Coordinates the sync workflow
- Manages database transactions
- Handles error recovery and statistics
- Provides the main public API

**Key Methods**:

- `syncKiotVietProductsToActa(user: JwtPayload)` - Main sync method

**Dependencies**:

- KiotVietProductMappingHelper
- KiotVietProductRelationshipsHelper
- KiotVietWarehouseHelper
- KiotVietSyncingHelpersService

### 2. KiotVietProductMappingHelper (Data Transformations)

**Purpose**: Handles all data transformations and mapping between KiotViet and ACTA formats.

**Key Responsibilities**:

- Transform KiotViet product data to ACTA format
- Map enums and data types
- Extract unique entities from product collections
- Build product specifications

**Key Methods**:

- `buildProductData(kiotVietProduct, categoryId, businessId)` - Transform product data
- `mapProductType(kiotVietType)` - Map product types
- `mapTaxType(kiotVietTaxType)` - Map tax types
- `extractUniqueCategories(products)` - Extract categories
- `extractUniqueTradeMarks(products)` - Extract businesses
- `extractUniqueBranches(products)` - Extract warehouses

### 3. KiotVietProductRelationshipsHelper (Relationship Syncing)

**Purpose**: Manages synchronization of all product relationships and related entities.

**Key Responsibilities**:

- Sync product images
- Sync product inventories
- Sync product attributes
- Sync product units, price books, formulas, serials, etc.
- Handle relationship-specific error handling

**Key Methods**:

- `syncProductRelationships(tx, productId, kiotVietProduct, warehouseMap, syncDetails)` - Main coordinator
- `syncProductImages(tx, productId, images, stats)` - Image syncing
- `syncProductInventories(tx, productId, inventories, warehouseMap, stats)` - Inventory syncing
- `syncProductAttributes(tx, productId, attributes, stats)` - Attribute syncing
- Plus individual sync methods for each relationship type

### 4. KiotVietWarehouseHelper (Warehouse Management)

**Purpose**: Handles warehouse creation and management from KiotViet branch data.

**Key Responsibilities**:

- Create warehouses from inventory branches
- Maintain warehouse mappings
- Validate warehouse relationships

**Key Methods**:

- `syncWarehousesFromInventories(tx, inventories, warehouseMap, warehouseStats)` - Create from inventories
- `createWarehouse(tx, branchId, branchName, warehouseMap, warehouseStats)` - Create single warehouse
- `getOrCreateWarehouse(tx, branchId, branchName, warehouseMap, warehouseStats)` - Get or create
- `validateWarehouseMappings(inventories, warehouseMap)` - Validate mappings

### 5. KiotVietProductCrudService (CRUD Operations)

**Purpose**: Handles low-level CRUD operations for products (existing service, moved).

**Note**: This service was moved from the parent directory but remains largely unchanged.

### 6. KiotVietProductSyncingService (Legacy Service)

**Purpose**: The original large service file (moved for backward compatibility).

**Note**: This service is kept for reference and backward compatibility but should be phased out in favor of the new modular structure.

## Key Improvements

### 1. **Separation of Concerns**

- **Data Mapping**: Isolated in `KiotVietProductMappingHelper`
- **Relationship Syncing**: Isolated in `KiotVietProductRelationshipsHelper`
- **Warehouse Management**: Isolated in `KiotVietWarehouseHelper`
- **Orchestration**: Clean and focused in `KiotVietProductSyncService`

### 2. **Maintainability**

- **Smaller Files**: Each file has a single, clear responsibility
- **Testability**: Each helper can be unit tested independently
- **Readability**: Much easier to understand and modify
- **Reusability**: Helpers can be reused in other contexts

### 3. **Error Handling**

- **Granular Error Tracking**: Each helper tracks its own errors
- **Graceful Degradation**: Failures in one area don't affect others
- **Detailed Statistics**: Comprehensive tracking for monitoring

### 4. **Code Organization**

- **Logical Grouping**: Related functionality is grouped together
- **Clear Dependencies**: Easy to understand what depends on what
- **Modular Design**: Easy to add new features or modify existing ones

## Usage Examples

### Basic Sync

```typescript
import { KiotVietProductSyncService } from './products';

// Inject the service
constructor(
  private readonly productSyncService: KiotVietProductSyncService,
) {}

// Use the service
const result = await this.productSyncService.syncKiotVietProductsToActa(user);
```

### Using Individual Helpers

```typescript
import {
  KiotVietProductMappingHelper,
  KiotVietProductRelationshipsHelper,
} from './products';

// Transform data
const productData = this.mappingHelper.buildProductData(
  kiotVietProduct,
  categoryId,
  businessId,
);

// Sync relationships
await this.relationshipsHelper.syncProductRelationships(
  tx,
  productId,
  kiotVietProduct,
  warehouseMap,
  syncDetails,
);
```

## Migration Guide

### From Legacy Service

If you're currently using `KiotVietProductSyncingService`:

1. **Update Imports**:

   ```typescript
   // Old
   import { KiotVietProductSyncingService } from './kiotviet-syncing.product.service';

   // New
   import { KiotVietProductSyncService } from './products';
   ```

2. **Update Method Calls**:

   ```typescript
   // Old
   await this.syncingService.syncKiotVietProductsToActa(user);

   // New (same method name, different service)
   await this.productSyncService.syncKiotVietProductsToActa(user);
   ```

3. **Update Module Registration**:
   ```typescript
   // Add to providers in your module
   providers: [
     KiotVietProductSyncService,
     KiotVietProductMappingHelper,
     KiotVietProductRelationshipsHelper,
     KiotVietWarehouseHelper,
     // ... other providers
   ];
   ```

## Testing

### Unit Tests

Each helper can be tested independently:

```typescript
describe('KiotVietProductMappingHelper', () => {
  it('should map product type correctly', () => {
    expect(helper.mapProductType(1)).toBe('product');
    expect(helper.mapProductType(2)).toBe('service');
    expect(helper.mapProductType(3)).toBe('combo');
  });
});

describe('KiotVietWarehouseHelper', () => {
  it('should create warehouse from branch data', async () => {
    const result = await helper.createWarehouse(tx, 1, 'Branch 1', map, stats);
    expect(result).toBeTruthy();
  });
});
```

### Integration Tests

Test the main service with all helpers:

```typescript
describe('KiotVietProductSyncService', () => {
  it('should sync products successfully', async () => {
    const result = await service.syncKiotVietProductsToActa(user);
    expect(result.success).toBe(true);
  });
});
```

## Future Enhancements

### Planned Improvements

1. **Incremental Sync**: Only sync changed products
2. **Batch Processing**: Group API calls for better performance
3. **Background Jobs**: Move sync to queue system
4. **Advanced Error Recovery**: Retry mechanisms and partial sync
5. **Performance Monitoring**: Enhanced metrics and alerting

### Extension Points

The modular design makes it easy to:

- Add new relationship types
- Implement custom mapping logic
- Create specialized warehouse handlers
- Add new sync strategies

## Contributing

When adding new features:

1. **Choose the Right Helper**: Add functionality to the appropriate helper
2. **Create New Helpers**: If functionality doesn't fit existing helpers
3. **Update Tests**: Add unit tests for new methods
4. **Update Documentation**: Keep this README current
5. **Follow Patterns**: Use existing patterns for consistency

## Performance Considerations

- **Memory Usage**: Helpers are stateless and memory-efficient
- **Database Transactions**: All operations use a single transaction
- **Error Recovery**: Failed products don't affect successful ones
- **Caching**: Individual helpers can implement caching strategies
- **Monitoring**: Comprehensive statistics for performance tracking
