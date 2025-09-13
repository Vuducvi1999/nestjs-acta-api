# Deactivate Products Without Inventory Script

This script scans all products and their inventories, then deactivates products that don't have any inventory by setting `isActive` and `allowsSale` to `false`.

## 🎯 **Purpose**

Automatically identify and deactivate products that:

- Are currently active (`isActive: true`)
- Allow sales (`allowsSale: true`)
- Have no inventory (`onHand: 0` or no inventory records)

## 🚀 **Usage**

### Basic Usage

```bash
# Run the script (preview mode by default)
npm run deactivate:products-no-inventory
```

### Direct Execution

```bash
# Using ts-node directly
ts-node scripts/deactivate-products-without-inventory.ts
```

## 📊 **What the Script Does**

### 1. **Inventory Analysis**

- Scans all products in the database
- Checks `ProductInventory` records for each product
- Identifies products with `onHand > 0` (actual stock)
- Counts products without any inventory

### 2. **Product Status Check**

- Finds products that are:
  - `isActive: true` (currently active)
  - `allowsSale: true` (allowed for sale)
  - Have no inventory records OR all inventory records have `onHand: 0`

### 3. **Deactivation Process**

- Sets `isActive: false` (deactivates the product)
- Sets `allowsSale: false` (prevents sales)
- Updates `updatedAt` timestamp

## 📋 **Output Example**

```
🔍 Scanning products for inventory status...
📊 Getting product inventory statistics...

📊 Current Product Inventory Statistics:
============================================================
📦 Total Products: 1250
✅ Products with Inventory: 980
❌ Products without Inventory: 270
⚠️  Active Products without Inventory: 45
============================================================

📋 Found 45 active products without inventory

📋 Products to be deactivated (showing first 10):
1. Product A (PROD-001) - Business: biz-123
2. Product B (PROD-002) - Business: biz-456
3. Product C (PROD-003) - Business: biz-789
... and 35 more products

⚠️  To proceed, uncomment the update section in the script
```

## ⚠️ **Safety Features**

### **Preview Mode (Default)**

- Script runs in **preview mode** by default
- Shows statistics and lists products to be deactivated
- **NO CHANGES** are made to the database

### **Execution Mode**

- To actually deactivate products, you must **uncomment** the update section
- Processes products in batches of 50 to avoid memory issues
- Includes verification after completion

## 🔧 **How to Execute**

### **Step 1: Preview (Recommended First)**

```bash
npm run deactivate:products-no-inventory
```

### **Step 2: Review Output**

- Check the statistics
- Review the list of products to be deactivated
- Verify these are the correct products

### **Step 3: Execute (If Confident)**

1. **Edit the script file:**

   ```bash
   vim scripts/deactivate-products-without-inventory.ts
   ```

2. **Uncomment the update section** (remove the `/*` and `*/` around the update code)

3. **Run the script again:**
   ```bash
   npm run deactivate:products-no-inventory
   ```

## 📈 **Batch Processing**

The script processes products in batches of 50 to:

- Avoid memory issues with large datasets
- Provide progress feedback
- Include small delays between batches (100ms)

## 🔍 **Verification**

After execution, the script:

- Shows updated statistics
- Confirms all target products were deactivated
- Displays the final count of active products without inventory

## 🛡️ **Important Notes**

### **Before Running**

1. **Backup your database** - This operation cannot be easily undone
2. **Test on staging** - Verify the script works as expected
3. **Review the product list** - Ensure you're deactivating the right products

### **What Gets Deactivated**

- Products with `isActive: true` AND `allowsSale: true`
- Products with no inventory records
- Products where all inventory records have `onHand: 0`

### **What Stays Active**

- Products with any inventory (`onHand > 0`)
- Products already deactivated
- Products that don't allow sales

## 🐛 **Troubleshooting**

### **Error: "No products need to be deactivated"**

- All products already have inventory or are already deactivated
- Check if the inventory data is correct

### **Error: "Permission denied"**

- Check database user permissions
- Ensure you have UPDATE access to the Product table

### **Script runs but no changes**

- Make sure you uncommented the update section
- Check if there are any database constraints

## 📚 **Related Scripts**

- `backfill:avatar-urls` - Update avatar URLs
- `update:user-status-kyc` - Update user KYC status
- `reset:message-system` - Reset message system

## 🔄 **Reactivation**

To reactivate products later:

1. Add inventory records with `onHand > 0`
2. Manually update the product:
   ```sql
   UPDATE products
   SET isActive = true, allowsSale = true
   WHERE id = 'product-id';
   ```

---

**⚠️ WARNING: This script will permanently deactivate products!**
**Always backup your database and test on staging first.**
