# Enhanced KiotViet Product Synchronization

## Overview

This document describes the enhanced product synchronization functionality that has been implemented to provide comprehensive data sync between KiotViet and the ACTA e-commerce system.

## Key Enhancements

### 1. Detailed Product Information Fetching

The sync process now fetches detailed product information for each product individually from KiotViet, ensuring complete data synchronization including:

- **Product Attributes**: Custom attributes and specifications
- **Inventory Information**: Stock levels across all warehouses/branches
- **Product Units**: Alternative units and conversion values
- **Price Books**: Multiple pricing tiers
- **Product Formulas**: Material composition for manufactured products
- **Serial Numbers**: Individual product tracking
- **Batch Expiration**: Lot management and expiry tracking
- **Warranties**: Product warranty information
- **Shelf Locations**: Warehouse positioning data

### 2. Dynamic Warehouse Creation

The system now automatically creates warehouses from KiotViet branch information found in product inventories:

```typescript
// Warehouses are created dynamically from product inventory branches
await this.syncWarehousesFromInventories(
  tx,
  detailedProduct.inventories,
  warehouseMap,
  syncDetails.warehouseStats!,
);
```

### 3. Comprehensive Relationship Syncing

Each product is now synced with all its related entities:

#### Product Images

- Automatically synced from KiotViet image URLs
- Maintains sort order and main image designation

#### Product Inventories

- Per-warehouse stock levels
- Cost tracking
- Reserved quantities
- Minimum/maximum stock levels

#### Product Attributes

- Custom product specifications
- KiotViet attribute mapping
- Dynamic attribute creation

#### Product Units

- Alternative measurement units
- Conversion factors
- Master unit relationships

#### Product Price Books

- Multiple pricing tiers
- Customer group pricing
- Time-based pricing rules

#### Product Formulas

- Material composition
- Quantity requirements
- BOM (Bill of Materials) support

#### Product Serials

- Individual product tracking
- Status management
- Warehouse assignment

#### Product Batch Expiration

- Lot tracking
- Expiration date management
- FEFO/FIFO support

#### Product Warranties

- Warranty types and durations
- Electronic vs manual warranties
- Time-based warranty tracking

#### Product Shelves

- Physical location tracking
- Warehouse-specific positioning
- Inventory organization

## New Sync Flow

### Phase 1: Basic Product Sync

1. Fetch product list from KiotViet
2. Extract unique categories, businesses, and branches
3. Create/update categories and businesses
4. Create/update warehouses from branch information

### Phase 2: Detailed Product Sync

For each product:

1. **Fetch Detailed Information**: Call KiotViet API for complete product details
2. **Sync Warehouses**: Create any missing warehouses from inventory branches
3. **Create/Update Product**: With all basic product information
4. **Sync Relationships**: Process all related entities

```typescript
// Enhanced sync method
private async syncProductsWithDetailedInfo(
  tx: any,
  user: JwtPayload,
  mappedProducts: any[],
  categoryMap: Map<number, string>,
  businessMap: Map<number, string>,
  warehouseMap: Map<number, string>,
  syncDetails: SyncLogDetails,
): Promise<void>
```

### Phase 3: Relationship Processing

Each relationship type is processed independently:

```typescript
await this.syncProductRelationships(
  tx,
  productId,
  detailedProduct,
  warehouseMap,
  syncDetails,
);
```

## Data Mapping

### KiotViet to ACTA Mapping

| KiotViet Field         | ACTA Field                      | Notes                 |
| ---------------------- | ------------------------------- | --------------------- |
| `id`                   | `kiotVietProductId`             | Foreign key reference |
| `code`                 | `code`                          | Product SKU           |
| `name`                 | `name`                          | Product name          |
| `basePrice`            | `price`, `basePrice`            | Pricing information   |
| `inventories.branchId` | `warehouse.kiotVietWarehouseId` | Warehouse mapping     |
| `attributes`           | `productAttributes`             | Custom specifications |
| `units`                | `productUnits`                  | Alternative units     |
| `priceBooks`           | `productPriceBooks`             | Pricing tiers         |
| `productFormulas`      | `productFormulas`               | BOM data              |
| `serials`              | `productSerials`                | Serial tracking       |
| `productBatchExpires`  | `productBatchExpires`           | Lot management        |
| `productWarranties`    | `productWarranties`             | Warranty info         |
| `productShelves`       | `productShelves`                | Location data         |

### Enum Mappings

#### Product Type

- `1` → `product`
- `2` → `service`
- `3` → `combo`

#### Tax Type

- `0%` → `zero`
- `5%` → `five`
- `8%` → `eight`
- `10%` → `ten`
- `kct` → `kct`
- `kkknt` → `kkknt`
- Others → `khac`

#### Warranty Type

- `0` → `none`
- `1` → `electronic`
- `2` → `manual_ticket`
- `3` → `exchange_only`
- `4` → `return_only`
- `5` → `exchange_and_return`
- `6` → `manufacturer_warranty`
- `7` → `store_warranty`
- `8` → `lifetime`
- `9` → `service_included`

#### Warranty Time Type

- `1` → `day`
- `2` → `month`
- `3` → `year`

## Performance Considerations

### API Rate Limiting

- Individual product fetching may increase API calls
- Consider implementing batch processing for large datasets
- Implement retry logic for failed requests

### Transaction Management

- All changes are wrapped in a single transaction
- Rollback on high failure rates (>80%)
- Timeout protection (5 minutes)

### Error Handling

- Detailed error logging for each relationship type
- Graceful degradation for missing data
- Statistics tracking for monitoring

## Statistics Tracking

The enhanced sync provides detailed statistics for each entity type:

```typescript
export interface SyncLogDetails {
  // ... existing stats
  productImageStats: SyncStats;
  productInventoryStats: SyncStats;
  productAttributeStats: SyncStats;
  productUnitStats: SyncStats;
  productPriceBookStats: SyncStats;
  productFormulaStats: SyncStats;
  productSerialStats: SyncStats;
  productBatchExpireStats: SyncStats;
  productWarrantyStats: SyncStats;
  productShelfStats: SyncStats;
}
```

## Usage

The enhanced sync is automatically used when calling the existing sync endpoint:

```bash
POST /api/integrations/kiotviet/sync/from-kiotviet/:organizationId
```

## Error Recovery

### Partial Sync Failure

- Individual product failures don't affect other products
- Detailed error messages for troubleshooting
- Resume capability for failed products

### Relationship Sync Failure

- Product creation succeeds even if relationships fail
- Individual relationship types can be re-synced
- Error statistics help identify problematic data

## Monitoring

### Sync Statistics

Monitor the following metrics:

- Product success/failure rates
- Relationship sync statistics
- API call performance
- Warehouse creation counts

### Log Analysis

Key log messages to monitor:

- `Starting detailed product sync for X products`
- `Created warehouse X from inventory branch Y`
- `Successfully synced product X`
- `Failed to sync product X: error`

## Future Enhancements

### Planned Improvements

1. **Incremental Sync**: Only sync changed products
2. **Batch Processing**: Group API calls for better performance
3. **Background Jobs**: Move detailed sync to queue
4. **Cache Optimization**: Improve caching strategies
5. **Real-time Updates**: Webhook-based synchronization

### Extensibility

The modular design allows for easy addition of new relationship types:

```typescript
// Add new relationship sync method
private async syncProductNewRelation(
  tx: any,
  productId: string,
  newRelations: any[],
  stats: any,
): Promise<void> {
  // Implementation
}

// Add to main sync method
await this.syncProductNewRelation(
  tx,
  productId,
  kiotVietProduct.newRelations,
  syncDetails.productNewRelationStats!,
);
```
