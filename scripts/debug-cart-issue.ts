import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugCartIssue() {
  try {
    console.log('🔍 Debugging cart issue...');

    // Find a test user
    const testUser = await prisma.user.findFirst({
      where: {
        email: {
          contains: 'test',
        },
      },
      include: {
        customer: true,
      },
    });

    if (!testUser) {
      console.log('❌ No test user found');
      return;
    }

    console.log(`👤 Found test user: ${testUser.email}`);

    // Check if user has a cart
    let cart = await prisma.cart.findUnique({
      where: { userId: testUser.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                business: true,
                inventories: {
                  select: {
                    id: true,
                    warehouseId: true,
                    onHand: true,
                    reserved: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      console.log('❌ No cart found for user');
      return;
    }

    console.log(`🛒 Found cart with ${cart.items.length} items`);

    if (cart.items.length === 0) {
      console.log('❌ Cart is empty');
      return;
    }

    // Check each cart item
    for (const item of cart.items) {
      console.log(`\n📦 Cart item: ${item.product.name}`);
      console.log(`   Quantity: ${item.quantity}`);
      console.log(`   Product active: ${item.product.isActive}`);
      console.log(`   Product allows sale: ${item.product.allowsSale}`);
      console.log(`   Business ID: ${item.product.businessId}`);
      console.log(`   Inventories: ${item.product.inventories.length}`);

      if (item.product.inventories.length > 0) {
        for (const inv of item.product.inventories) {
          console.log(
            `     Warehouse ${inv.warehouseId}: ${inv.onHand} on hand, ${inv.reserved} reserved`,
          );
        }
      }
    }

    // Check default warehouse
    const defaultWarehouse = await prisma.warehouse.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (defaultWarehouse) {
      console.log(
        `\n🏪 Default warehouse: ${defaultWarehouse.name} (${defaultWarehouse.id})`,
      );

      // Check if cart items have inventory in this warehouse
      for (const item of cart.items) {
        const warehouseInventory = item.product.inventories.find(
          (inv) => inv.warehouseId === defaultWarehouse.id,
        );

        if (warehouseInventory) {
          const availableStock =
            warehouseInventory.onHand - warehouseInventory.reserved;
          console.log(
            `   ${item.product.name}: ${availableStock} available in default warehouse`,
          );
        } else {
          console.log(
            `   ${item.product.name}: No inventory in default warehouse`,
          );
        }
      }
    } else {
      console.log('❌ No default warehouse found');
    }

    // Test the cart service methods
    console.log('\n🧪 Testing cart service methods...');

    // Simulate the cart validation that happens during checkout
    const cartValidation = await validateCartForCheckout(
      testUser.id,
      defaultWarehouse?.id,
    );
    console.log('Cart validation result:', cartValidation);
  } catch (error) {
    console.error('❌ Error debugging cart issue:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Simulate the cart validation method from the service
async function validateCartForCheckout(userId: string, warehouseId?: string) {
  try {
    // Get raw cart data for validation
    const rawCart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                business: true,
                inventories: {
                  select: {
                    id: true,
                    warehouseId: true,
                    onHand: true,
                    reserved: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rawCart || !rawCart.items || rawCart.items.length === 0) {
      return {
        isValid: false,
        errors: ['Giỏ hàng trống'],
        warnings: [],
        validItems: [],
        invalidItems: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const validItems: any[] = [];
    const invalidItems: any[] = [];

    // Get default warehouse if not specified
    let targetWarehouseId = warehouseId;
    if (!targetWarehouseId) {
      const defaultWarehouse = await prisma.warehouse.findFirst({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (!defaultWarehouse) {
        return {
          isValid: false,
          errors: [
            'Không tìm thấy kho hàng mặc định. Vui lòng liên hệ quản trị viên.',
          ],
          warnings: [],
          validItems: [],
          invalidItems: [],
        };
      }

      targetWarehouseId = defaultWarehouse.id;
    }

    for (const item of rawCart.items) {
      try {
        const product = item.product;

        // Validate product status
        if (!product.isActive) {
          errors.push(`Sản phẩm "${product.name}" không còn hoạt động`);
          invalidItems.push(item);
          continue;
        }

        if (!product.allowsSale) {
          errors.push(`Sản phẩm "${product.name}" không cho phép bán hàng`);
          invalidItems.push(item);
          continue;
        }

        if (!product.businessId) {
          errors.push(
            `Sản phẩm "${product.name}" không có thông tin doanh nghiệp hợp lệ`,
          );
          invalidItems.push(item);
          continue;
        }

        // Validate inventory
        if (!product.inventories || product.inventories.length === 0) {
          errors.push(`Sản phẩm "${product.name}" không có tồn kho`);
          invalidItems.push(item);
          continue;
        }

        // Check warehouse-specific inventory
        const warehouseInventory = product.inventories.find(
          (inv) => inv.warehouseId === targetWarehouseId,
        );

        if (!warehouseInventory) {
          errors.push(
            `Sản phẩm "${product.name}" không có tồn kho trong kho hàng được chọn`,
          );
          invalidItems.push(item);
          continue;
        }

        const availableStock =
          warehouseInventory.onHand - warehouseInventory.reserved;
        if (availableStock < item.quantity) {
          errors.push(
            `Sản phẩm "${product.name}" chỉ còn ${availableStock} sản phẩm trong kho`,
          );
          invalidItems.push(item);
          continue;
        }

        // Item is valid
        validItems.push(item);
      } catch (error) {
        errors.push(
          `Lỗi khi kiểm tra sản phẩm "${item.product.name}": ${error.message}`,
        );
        invalidItems.push(item);
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      validItems,
      invalidItems,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Lỗi khi kiểm tra giỏ hàng: ${error.message}`],
      warnings: [],
      validItems: [],
      invalidItems: [],
    };
  }
}

// Run the debug script
debugCartIssue()
  .then(() => {
    console.log('✅ Debug script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
  });
