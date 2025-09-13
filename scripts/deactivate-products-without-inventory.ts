#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getProductInventoryStats() {
  console.log('📊 Getting product inventory statistics...\n');

  try {
    // Get total products
    const totalProducts = await prisma.product.count();

    // Get products with inventory (any inventory record with quantity > 0)
    const productsWithInventory = await prisma.product.count({
      where: {
        inventories: {
          some: {
            onHand: {
              gt: 0,
            },
          },
        },
      },
    });

    // Get products without inventory
    const productsWithoutInventory = totalProducts - productsWithInventory;

    // Get active products without inventory (these are the ones we'll deactivate)
    const activeProductsWithoutInventory = await prisma.product.count({
      where: {
        isActive: true,
        allowsSale: true,
        inventories: {
          none: {
            onHand: {
              gt: 0,
            },
          },
        },
      },
    });

    return {
      totalProducts,
      productsWithInventory,
      productsWithoutInventory,
      activeProductsWithoutInventory,
    };
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    throw error;
  }
}

async function deactivateProductsWithoutInventory() {
  console.log('🔍 Scanning products for inventory status...');

  try {
    // Get statistics first
    const stats = await getProductInventoryStats();

    console.log('📊 Current Product Inventory Statistics:');
    console.log('='.repeat(60));
    console.log(`📦 Total Products: ${stats.totalProducts}`);
    console.log(`✅ Products with Inventory: ${stats.productsWithInventory}`);
    console.log(
      `❌ Products without Inventory: ${stats.productsWithoutInventory}`,
    );
    console.log(
      `⚠️  Active Products without Inventory: ${stats.activeProductsWithoutInventory}`,
    );
    console.log('='.repeat(60));

    if (stats.activeProductsWithoutInventory === 0) {
      console.log('\n✅ No products need to be deactivated');
      return;
    }

    // Get products without inventory
    const productsWithoutInventory = await prisma.product.findMany({
      where: {
        isActive: true,
        allowsSale: true,
        inventories: {
          none: {
            onHand: {
              gt: 0,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        businessId: true,
        isActive: true,
        allowsSale: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log(
      `\n📋 Found ${productsWithoutInventory.length} active products without inventory`,
    );

    // Show preview
    console.log('\n📋 Products to be deactivated (showing first 10):');
    productsWithoutInventory.slice(0, 10).forEach((product, index) => {
      console.log(
        `${index + 1}. ${product.name} (${product.code}) - Business: ${product.businessId}`,
      );
    });

    if (productsWithoutInventory.length > 10) {
      console.log(
        `... and ${productsWithoutInventory.length - 10} more products`,
      );
    }

    console.log('\n⚠️  To proceed, uncomment the update section in the script');

    // UNCOMMENT BELOW TO ACTUALLY UPDATE
    console.log('\n🔄 Deactivating products...');
    
    // Process in batches to avoid memory issues
    const BATCH_SIZE = 50;
    let totalDeactivated = 0;
    
    for (let i = 0; i < productsWithoutInventory.length; i += BATCH_SIZE) {
      const batch = productsWithoutInventory.slice(i, i + BATCH_SIZE);
      const batchIds = batch.map(p => p.id);
      
      const result = await prisma.product.updateMany({
        where: {
          id: {
            in: batchIds,
          },
        },
        data: {
          isActive: false,
          allowsSale: false,
          updatedAt: new Date(),
        },
      });
      
      totalDeactivated += result.count;
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deactivated ${result.count} products`);
      
      // Small delay between batches
      if (i + BATCH_SIZE < productsWithoutInventory.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n🎉 Successfully deactivated ${totalDeactivated} products`);
    
    // Verify the update
    const updatedStats = await getProductInventoryStats();
    console.log('\n📊 Updated Statistics:');
    console.log('='.repeat(60));
    console.log(`📦 Total Products: ${updatedStats.totalProducts}`);
    console.log(`✅ Products with Inventory: ${updatedStats.productsWithInventory}`);
    console.log(`❌ Products without Inventory: ${updatedStats.productsWithoutInventory}`);
    console.log(`⚠️  Active Products without Inventory: ${updatedStats.activeProductsWithoutInventory}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
deactivateProductsWithoutInventory().catch((e) => {
  console.error('💥 Script failed:', e);
  process.exit(1);
});
