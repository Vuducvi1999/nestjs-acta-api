# Undo Checkout Script

This script allows you to undo checkout processes by deleting orders and related data from the database. **This is for DEVELOPMENT USE ONLY!**

## ⚠️ WARNING

This script will **permanently delete** orders and related data from the database. Make sure you have backups before running this script.

## Installation

First, install the required dependency:

```bash
cd acta-ecomm-api
yarn add commander
```

## Usage

### Undo a specific order

```bash
# Using npm script
npm run undo:order <orderId>

# Using ts-node directly
ts-node scripts/undo-checkout.ts order <orderId>

# Example
npm run undo:order cmeuu5yk80004zgrah90lcj73
```

### Undo all orders for a specific user

```bash
# Using npm script
npm run undo:user <userId> --limit 5

# Using ts-node directly
ts-node scripts/undo-checkout.ts user <userId> --limit 5

# Example
npm run undo:user 41fe4f8a-5622-4358-93c9-e94cd69187e5 --limit 10
```

### Undo recent orders (last N hours)

```bash
# Using npm script
npm run undo:recent <hours> --limit 20

# Using ts-node directly
ts-node scripts/undo-checkout.ts recent <hours> --limit 20

# Example - undo orders from last 2 hours
npm run undo:recent 2 --limit 50
```

### List recent orders (for reference)

```bash
# Using npm script
npm run undo:list --limit 15

# Using ts-node directly
ts-node scripts/undo-checkout.ts list --limit 15

# Example
npm run undo:list --limit 20
```

## What gets deleted

When you undo an order, the following data is deleted in this order:

1. **Payment Transactions** - All transaction records for payments
2. **Payment Attempts** - All payment attempt records
3. **Payments** - The payment records themselves
4. **Order Payments** - The order payment records
5. **Order Delivery** - Delivery information
6. **Order Details** - Individual items in the order
7. **Order** - The main order record

## Examples

### Undo the most recent failed order

```bash
# First, list recent orders to find the one you want to undo
npm run undo:list --limit 5

# Then undo the specific order
npm run undo:order cmeuu5yk80004zgrah90lcj73
```

### Undo all orders for a test user

```bash
npm run undo:user 41fe4f8a-5622-4358-93c9-e94cd69187e5 --limit 100
```

### Undo all orders from the last hour

```bash
npm run undo:recent 1 --limit 100
```

## Troubleshooting

### Error: "Order not found"

- Make sure the order ID is correct
- Check if the order was already deleted

### Error: "Foreign key constraint"

- The script handles foreign key constraints by deleting in the correct order
- If you still get this error, there might be additional relationships not covered

### Error: "Permission denied"

- Make sure you have database access
- Check your database connection settings

## Safety Tips

1. **Always backup your database** before running this script
2. **Test on a development database** first
3. **Use the list command** to verify what you're about to delete
4. **Start with small limits** when using user or recent commands
5. **Double-check order IDs** before deleting

## Development Notes

This script is designed for development use when:

- Orders are created but payment fails
- You need to clean up test data
- You want to reset the checkout process
- You're debugging checkout issues

**Never use this script in production!**
