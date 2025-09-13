# Optimal Warehouse Selection for Checkout

## Overview

The checkout system now automatically selects the optimal warehouse for orders when no specific `warehouseId` is provided in the checkout request. This feature analyzes product inventories across all active warehouses to find the best warehouse for fulfilling the order.

## How It Works

### 1. Warehouse Selection Logic

When `warehouseId` is not provided in the `CreateOrderFromCartDto`, the system:

1. **Analyzes all active warehouses** that have stock for the products in the cart
2. **Calculates a score** for each warehouse based on:
   - **Product coverage**: Percentage of cart products available in the warehouse
   - **Available stock**: Total available quantity (onHand - reserved)
3. **Selects the warehouse** with the highest score

### 2. Scoring Algorithm

```
Score = (Coverage Percentage × 0.7) + (Stock Bonus)
```

Where:

- **Coverage Percentage** = (Products available in warehouse / Total cart products) × 100
- **Stock Bonus** = 30 points if warehouse has any available stock

### 3. Fallback Strategy

If optimal warehouse selection fails, the system falls back to:

1. The default warehouse (first active warehouse by creation date)
2. An error if no warehouses are available

## Implementation Details

### New Method: `CheckoutHelper.selectOptimalWarehouse()`

```typescript
static async selectOptimalWarehouse(
  tx: any,
  productIds: string[],
): Promise<Warehouse>
```

**Parameters:**

- `tx`: Prisma transaction object
- `productIds`: Array of product IDs from the cart

**Returns:**

- `Warehouse`: The optimally selected warehouse

### Integration Points

1. **Checkout Service**: Uses optimal warehouse selection when creating orders
2. **Cart Service**: Uses optimal warehouse selection for cart validation
3. **Automatic Fallback**: Gracefully handles errors with fallback to default warehouse

## Usage Examples

### 1. Checkout Without Specifying Warehouse

```typescript
// The system will automatically select the optimal warehouse
const orderData = {
  deliveryType: DeliveryType.ShipCOD,
  shippingAddress: {
    /* address details */
  },
  receiver: {
    /* receiver details */
  },
  paymentMethod: PaymentMethod.TRANSFER,
  agreedToTerms: true,
  // warehouseId is omitted - system will select optimal warehouse
};

const order = await checkoutService.createOrderFromCart(user, orderData);
```

### 2. Checkout With Specific Warehouse

```typescript
// The system will use the specified warehouse
const orderData = {
  warehouseId: 'warehouse-123', // Explicit warehouse selection
  deliveryType: DeliveryType.ShipCOD,
  // ... other fields
};

const order = await checkoutService.createOrderFromCart(user, orderData);
```

## Benefits

1. **Improved Order Fulfillment**: Orders are automatically routed to warehouses with the best product availability
2. **Better Customer Experience**: Reduces order failures due to stock unavailability
3. **Efficient Inventory Management**: Optimizes warehouse utilization across the network
4. **Automatic Fallback**: Ensures orders can still be processed even if optimal selection fails

## Configuration

The scoring algorithm can be adjusted by modifying the weights in `CheckoutHelper.selectOptimalWarehouse()`:

```typescript
// Current weights
const score = coveragePercentage * 0.7 + (totalAvailableStock > 0 ? 30 : 0);

// You can adjust these values based on business requirements
const score = coveragePercentage * 0.8 + (totalAvailableStock > 0 ? 20 : 0);
```

## Monitoring and Logging

The system logs warehouse selection decisions for monitoring:

```
Selected warehouse "Main Warehouse" with score 85.00, coverage: 100.0%, available stock: 150
No warehouse specified, selected optimal warehouse: Main Warehouse (warehouse-123)
```

## Testing

Run the test suite to verify optimal warehouse selection:

```bash
yarn test checkout.helper.spec.ts
```

## Error Handling

The system handles various error scenarios:

1. **No active warehouses**: Throws `BadRequestException`
2. **Optimal selection failure**: Falls back to default warehouse
3. **Database errors**: Logs warnings and uses fallback strategy

## Future Enhancements

Potential improvements for future versions:

1. **Geographic optimization**: Consider warehouse proximity to shipping address
2. **Cost optimization**: Factor in shipping costs from different warehouses
3. **Load balancing**: Distribute orders across warehouses more evenly
4. **Real-time inventory**: Use real-time stock levels for more accurate selection
5. **Business rules**: Allow configurable business rules for warehouse selection
