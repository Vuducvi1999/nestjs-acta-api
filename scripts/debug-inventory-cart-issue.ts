#!/usr/bin/env ts-node

/**
 * Deep Debug Script for Inventory-Cart Issue
 *
 * This script investigates why products without warehouse inventories can still be added to cart
 * and why the optimal warehouse selection is failing.
 *
 * Usage:
 * npx ts-node scripts/debug-inventory-cart-issue.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface InventoryAnalysis {
  productId: string;
  productName: string;
  productCode: string;
  isActive: boolean;
  allowsSale: boolean;
  businessId: string;
  businessName: string;
  totalInventories: number;
  warehousesWithStock: number;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
  warehouseDetails: Array<{
    warehouseId: string;
    warehouseName: string;
    onHand: number;
    reserved: number;
    available: number;
  }>;
}

interface CartAnalysis {
  userId: string;
  userEmail: string;
  cartId: string;
  cartItemCount: number;
  items: Array<{
    cartItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    hasInventory: boolean;
    inventorySummary: string;
  }>;
}

class InventoryCartDebugger {
  /**
   * Analyze a specific product's inventory status
   */
  async analyzeProductInventory(
    productId: string,
  ): Promise<InventoryAnalysis | null> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          business: true,
          inventories: {
            include: {
              warehouse: true,
            },
          },
        },
      });

      if (!product) {
        console.log(`❌ Product ${productId} not found`);
        return null;
      }

      const totalInventories = product.inventories.length;
      const warehousesWithStock = product.inventories.filter(
        (inv) => inv.onHand > 0,
      ).length;
      const totalStock = product.inventories.reduce(
        (sum, inv) => sum + inv.onHand,
        0,
      );
      const reservedStock = product.inventories.reduce(
        (sum, inv) => sum + (inv.reserved || 0),
        0,
      );
      const availableStock = totalStock - reservedStock;

      const warehouseDetails = product.inventories.map((inv) => ({
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        onHand: inv.onHand,
        reserved: inv.reserved || 0,
        available: inv.onHand - (inv.reserved || 0),
      }));

      return {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        isActive: product.isActive,
        allowsSale: product.allowsSale,
        businessId: product.businessId,
        businessName: product.business.name,
        totalInventories,
        warehousesWithStock,
        totalStock,
        reservedStock,
        availableStock,
        warehouseDetails,
      };
    } catch (error) {
      console.error(`❌ Error analyzing product ${productId}:`, error);
      return null;
    }
  }

  /**
   * Analyze all products and their inventory status
   */
  async analyzeAllProductsInventory(): Promise<void> {
    console.log('🔍 Analyzing all products and their inventory status...\n');

    try {
      // Get all products with their inventories
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          allowsSale: true,
        },
        include: {
          business: true,
          inventories: {
            include: {
              warehouse: true,
            },
          },
        },
        take: 50, // Limit to first 50 for performance
      });

      console.log(`📊 Found ${products.length} active products for sale\n`);

      let productsWithInventory = 0;
      let productsWithoutInventory = 0;
      let productsWithZeroStock = 0;
      let totalStock = 0;

      for (const product of products) {
        const inventoryCount = product.inventories.length;
        const stockCount = product.inventories.reduce(
          (sum, inv) => sum + inv.onHand,
          0,
        );
        const availableStock = product.inventories.reduce(
          (sum, inv) => sum + (inv.onHand - (inv.reserved || 0)),
          0,
        );

        if (inventoryCount > 0) {
          productsWithInventory++;
          if (stockCount === 0) {
            productsWithZeroStock++;
          }
        } else {
          productsWithoutInventory++;
        }

        totalStock += stockCount;

        // Show detailed info for products with issues
        if (inventoryCount === 0 || stockCount === 0) {
          console.log(`⚠️  ${product.name} (${product.code})`);
          console.log(`    Business: ${product.business.name}`);
          console.log(`    Inventories: ${inventoryCount}`);
          console.log(`    Total Stock: ${stockCount}`);
          console.log(`    Available: ${availableStock}`);
          console.log('');
        }
      }

      console.log('📊 Inventory Summary:');
      console.log('='.repeat(50));
      console.log(`Total Products Analyzed: ${products.length}`);
      console.log(`Products with Inventory Records: ${productsWithInventory}`);
      console.log(
        `Products without Inventory Records: ${productsWithoutInventory}`,
      );
      console.log(`Products with Zero Stock: ${productsWithZeroStock}`);
      console.log(`Total Stock Across All Products: ${totalStock}`);
      console.log('='.repeat(50));
    } catch (error) {
      console.error('❌ Error analyzing products:', error);
    }
  }

  /**
   * Analyze cart items and their inventory status
   */
  async analyzeCartInventory(): Promise<void> {
    console.log('\n🛒 Analyzing cart items and their inventory status...\n');

    try {
      // Get all carts with items
      const carts = await prisma.cart.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  business: true,
                  inventories: {
                    include: {
                      warehouse: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 20, // Limit for performance
      });

      console.log(`📊 Found ${carts.length} carts with items\n`);

      let totalCartItems = 0;
      let itemsWithInventory = 0;
      let itemsWithoutInventory = 0;
      let itemsWithZeroStock = 0;

      for (const cart of carts) {
        if (cart.items.length === 0) continue;

        console.log(`👤 User: ${cart.user.fullName} (${cart.user.email})`);
        console.log(`🛒 Cart ID: ${cart.id}`);
        console.log(`📦 Items: ${cart.items.length}`);

        for (const item of cart.items) {
          totalCartItems++;
          const product = item.product;
          const inventoryCount = product.inventories.length;
          const totalStock = product.inventories.reduce(
            (sum, inv) => sum + inv.onHand,
            0,
          );
          const availableStock = product.inventories.reduce(
            (sum, inv) => sum + (inv.onHand - (inv.reserved || 0)),
            0,
          );

          if (inventoryCount > 0) {
            itemsWithInventory++;
            if (totalStock === 0) {
              itemsWithZeroStock++;
            }
          } else {
            itemsWithoutInventory++;
          }

          const status =
            inventoryCount === 0
              ? '❌ NO INVENTORY'
              : totalStock === 0
                ? '⚠️  ZERO STOCK'
                : availableStock < item.quantity
                  ? '⚠️  INSUFFICIENT STOCK'
                  : '✅ OK';

          console.log(`   ${status} ${product.name} (Qty: ${item.quantity})`);
          console.log(
            `      Inventories: ${inventoryCount}, Stock: ${totalStock}, Available: ${availableStock}`,
          );

          if (inventoryCount > 0) {
            for (const inv of product.inventories) {
              const available = inv.onHand - (inv.reserved || 0);
              const status = available >= item.quantity ? '✅' : '❌';
              console.log(
                `      ${status} ${inv.warehouse.name}: ${inv.onHand} on hand, ${inv.reserved || 0} reserved, ${available} available`,
              );
            }
          }
          console.log('');
        }
        console.log('─'.repeat(60));
      }

      console.log('📊 Cart Inventory Summary:');
      console.log('='.repeat(50));
      console.log(`Total Cart Items Analyzed: ${totalCartItems}`);
      console.log(`Items with Inventory Records: ${itemsWithInventory}`);
      console.log(`Items without Inventory Records: ${itemsWithoutInventory}`);
      console.log(`Items with Zero Stock: ${itemsWithZeroStock}`);
      console.log('='.repeat(50));
    } catch (error) {
      console.error('❌ Error analyzing cart inventory:', error);
    }
  }

  /**
   * Test the cart service validation logic
   */
  async testCartServiceValidation(): Promise<void> {
    console.log('\n🧪 Testing cart service validation logic...\n');

    try {
      // Find a cart with items
      const cart = await prisma.cart.findFirst({
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                include: {
                  business: true,
                  inventories: {
                    include: {
                      warehouse: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        console.log('❌ No cart with items found for testing');
        return;
      }

      console.log(`👤 Testing with user: ${cart.user.email}`);
      console.log(`🛒 Cart has ${cart.items.length} items\n`);

      // Simulate the cart service validation logic
      for (const item of cart.items) {
        const product = item.product;
        console.log(`📦 Testing product: ${product.name}`);

        // Check product status (what cart service checks)
        console.log(`   ✅ Product active: ${product.isActive}`);
        console.log(`   ✅ Product allows sale: ${product.allowsSale}`);
        console.log(`   ✅ Has business: ${!!product.businessId}`);

        // Check inventory (what cart service should check but doesn't)
        const inventoryCount = product.inventories.length;
        const totalStock = product.inventories.reduce(
          (sum, inv) => sum + inv.onHand,
          0,
        );
        const availableStock = product.inventories.reduce(
          (sum, inv) => sum + (inv.onHand - (inv.reserved || 0)),
          0,
        );

        console.log(
          `   ${inventoryCount > 0 ? '✅' : '❌'} Has inventory records: ${inventoryCount}`,
        );
        console.log(
          `   ${totalStock > 0 ? '✅' : '❌'} Has stock: ${totalStock}`,
        );
        console.log(
          `   ${availableStock >= item.quantity ? '✅' : '❌'} Sufficient stock for quantity ${item.quantity}: ${availableStock}`,
        );

        if (inventoryCount === 0) {
          console.log(
            `   ⚠️  PROBLEM: Product has no inventory records but can be added to cart!`,
          );
        } else if (totalStock === 0) {
          console.log(
            `   ⚠️  PROBLEM: Product has inventory records but zero stock!`,
          );
        } else if (availableStock < item.quantity) {
          console.log(
            `   ⚠️  PROBLEM: Product has insufficient available stock!`,
          );
        }

        console.log('');
      }
    } catch (error) {
      console.error('❌ Error testing cart service validation:', error);
    }
  }

  /**
   * Test warehouse selection logic
   */
  async testWarehouseSelection(): Promise<void> {
    console.log('\n🏪 Testing warehouse selection logic...\n');

    try {
      // Get all active warehouses
      const warehouses = await prisma.warehouse.findMany({
        where: { isActive: true },
        include: {
          productInventories: {
            include: {
              product: true,
            },
          },
        },
      });

      console.log(`📊 Found ${warehouses.length} active warehouses\n`);

      for (const warehouse of warehouses) {
        const inventoryCount = warehouse.productInventories.length;
        const productsWithStock = warehouse.productInventories.filter(
          (inv) => inv.onHand > 0,
        ).length;
        const totalStock = warehouse.productInventories.reduce(
          (sum, inv) => sum + inv.onHand,
          0,
        );

        console.log(`🏪 ${warehouse.name} (${warehouse.id})`);
        console.log(`   Total product inventories: ${inventoryCount}`);
        console.log(`   Products with stock: ${productsWithStock}`);
        console.log(`   Total stock: ${totalStock}`);

        if (inventoryCount > 0) {
          console.log(`   Sample products:`);
          warehouse.productInventories.slice(0, 3).forEach((inv) => {
            const available = inv.onHand - (inv.reserved || 0);
            console.log(
              `     - ${inv.product.name}: ${inv.onHand} on hand, ${inv.reserved || 0} reserved, ${available} available`,
            );
          });
        }
        console.log('');
      }
    } catch (error) {
      console.error('❌ Error testing warehouse selection:', error);
    }
  }

  /**
   * Find products that can be added to cart but shouldn't be
   */
  async findProblematicProducts(): Promise<void> {
    console.log('\n🚨 Finding problematic products...\n');

    try {
      // Find products that are active, allow sales, but have no inventory or zero stock
      const problematicProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          allowsSale: true,
          OR: [
            {
              inventories: {
                none: {},
              },
            },
            {
              inventories: {
                every: {
                  onHand: 0,
                },
              },
            },
          ],
        },
        include: {
          business: true,
          inventories: {
            include: {
              warehouse: true,
            },
          },
          cartItems: {
            include: {
              cart: {
                include: {
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        take: 20,
      });

      console.log(
        `🚨 Found ${problematicProducts.length} problematic products\n`,
      );

      for (const product of problematicProducts) {
        const inventoryCount = product.inventories.length;
        const totalStock = product.inventories.reduce(
          (sum, inv) => sum + inv.onHand,
          0,
        );
        const cartItemCount = product.cartItems.length;

        console.log(`📦 ${product.name} (${product.code})`);
        console.log(`   Business: ${product.business.name}`);
        console.log(`   Inventory records: ${inventoryCount}`);
        console.log(`   Total stock: ${totalStock}`);
        console.log(`   Currently in ${cartItemCount} carts`);

        if (cartItemCount > 0) {
          console.log(`   Users with this product in cart:`);
          product.cartItems.forEach((item) => {
            console.log(
              `     - ${item.cart.user.email} (Qty: ${item.quantity})`,
            );
          });
        }

        if (inventoryCount === 0) {
          console.log(
            `   ❌ PROBLEM: No inventory records - should not be allowed for sale`,
          );
        } else if (totalStock === 0) {
          console.log(
            `   ❌ PROBLEM: Has inventory records but zero stock - should not be allowed for sale`,
          );
        }

        console.log('');
      }
    } catch (error) {
      console.error('❌ Error finding problematic products:', error);
    }
  }

  /**
   * Provide recommendations for fixing the issue
   */
  async provideRecommendations(): Promise<void> {
    console.log('\n💡 Recommendations for fixing the inventory-cart issue:\n');

    console.log('1. 🔒 STRENGTHEN CART VALIDATION:');
    console.log(
      '   - Modify addToCart() in PublicCartService to check inventory availability',
    );
    console.log('   - Prevent adding products with zero stock to cart');
    console.log('   - Add inventory validation before allowing cart addition');

    console.log('\n2. 🏪 IMPROVE WAREHOUSE SELECTION:');
    console.log(
      '   - Fix the availableStock field issue in selectOptimalWarehouse',
    );
    console.log(
      '   - Ensure warehouse selection only considers warehouses with actual stock',
    );
    console.log(
      '   - Add fallback logic when no warehouse has sufficient stock',
    );

    console.log('\n3. 📦 INVENTORY MANAGEMENT:');
    console.log(
      '   - Ensure all products have inventory records in at least one warehouse',
    );
    console.log('   - Set minimum stock thresholds for products');
    console.log('   - Automatically deactivate products with zero stock');

    console.log('\n4. 🧪 TESTING:');
    console.log('   - Add integration tests for cart + inventory validation');
    console.log(
      '   - Test warehouse selection with various inventory scenarios',
    );
    console.log(
      '   - Validate that products without stock cannot be purchased',
    );

    console.log('\n5. 📊 MONITORING:');
    console.log('   - Add alerts for products added to cart without inventory');
    console.log('   - Monitor warehouse selection failures');
    console.log('   - Track inventory vs. cart item mismatches');
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    console.log('🔍 Deep Debug Script for Inventory-Cart Issue\n');
    console.log('This script will investigate:');
    console.log('1. Product inventory status across all products');
    console.log('2. Cart items and their inventory validation');
    console.log('3. Cart service validation logic');
    console.log('4. Warehouse selection logic');
    console.log('5. Problematic products that can be added to cart');
    console.log('6. Recommendations for fixing the issues\n');

    try {
      await this.analyzeAllProductsInventory();
      await this.analyzeCartInventory();
      await this.testCartServiceValidation();
      await this.testWarehouseSelection();
      await this.findProblematicProducts();
      await this.provideRecommendations();

      console.log('\n✅ Deep debug analysis completed!');
      console.log(
        '📋 Review the findings above to understand the root causes.',
      );
      console.log(
        '🔧 Use the recommendations to fix the inventory-cart issues.',
      );
    } catch (error) {
      console.error('\n💥 Deep debug analysis failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run the debug script if this file is executed directly
if (require.main === module) {
  const debuggerInstance = new InventoryCartDebugger();
  debuggerInstance.run();
}

export { InventoryCartDebugger };
