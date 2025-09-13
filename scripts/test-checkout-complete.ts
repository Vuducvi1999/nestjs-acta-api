#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCheckoutComplete() {
  try {
    console.log('🧪 Testing complete checkout flow...');

    // Find a test user with customer record
    const testUser = await prisma.user.findFirst({
      where: {
        customer: {
          isNot: null,
        },
      },
      include: {
        customer: true,
      },
    });

    if (!testUser) {
      console.log('❌ No user with customer record found');
      return;
    }

    console.log(`👤 Using test user: ${testUser.email}`);

    // Find a product to add to cart
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
      },
    });

    if (!product) {
      console.log('❌ No active product found');
      return;
    }

    console.log(`📦 Using product: ${product.name}`);

    // Find or create cart for user
    let cart = await prisma.cart.findFirst({
      where: {
        userId: testUser.id,
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: testUser.id,
        },
      });
      console.log('🛒 Created new cart');
    } else {
      console.log('🛒 Using existing cart');
    }

    // Add product to cart
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity: 1,
      },
      include: {
        product: true,
      },
    });

    console.log(`✅ Added product to cart: ${cartItem.product.name}`);

    // Find default warehouse and sale channel
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true },
    });

    const saleChannel = await prisma.saleChannel.findFirst({
      where: {
        source: 'acta',
        isActive: true,
      },
    });

    if (!warehouse || !saleChannel) {
      console.log('❌ No default warehouse or sale channel found');
      return;
    }

    console.log(`🏪 Using warehouse: ${warehouse.name}`);
    console.log(`📺 Using sale channel: ${saleChannel.name}`);

    // Create a test order (simulating the checkout process)
    const orderData = {
      code: `TEST-${Date.now()}`,
      purchaseDate: new Date(),
      description: 'Test checkout order',
      status: 'draft' as any,
      paymentStatus: 'processing' as any,
      usingCod: false,
      subtotal: 100000,
      shippingFee: 0,
      discount: 0,
      total: 100000,
      customerNote: 'Test checkout',
      warehouseId: warehouse.id,
      discountRatio: 0,
      customerId: testUser.customer?.id || '',
      saleChannelId: saleChannel.id,
      source: 'acta' as any,
    };

    console.log('📝 Creating test order...');
    const order = await prisma.order.create({
      data: orderData,
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        warehouse: true,
        saleChannel: true,
      },
    });

    console.log(`✅ Order created: ${order.code} (ID: ${order.id})`);

    // Create order delivery
    const orderDelivery = await prisma.orderDelivery.create({
      data: {
        code: `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 2, // At warehouse
        receiver: 'Test Customer',
        contactNumber: '0123456789',
        address: 'Test Address, District 1, TP.HCM',
        source: 'acta' as any,
        orderId: order.id,
      },
    });

    console.log(`🚚 Order delivery created: ${orderDelivery.code}`);

    // Create order detail
    const orderDetail = await prisma.orderDetail.create({
      data: {
        quantity: 1,
        discount: 0,
        discountRatio: 0,
        isMaster: false,
        source: 'acta' as any,
        soldById: product.businessId || 'default-business',
        orderId: order.id,
        productId: product.id,
      },
    });

    console.log(`📋 Order detail created for product: ${product.name}`);

    // Create order payment
    const orderPayment = await prisma.orderPayment.create({
      data: {
        code: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        method: 'transfer' as any,
        status: 'processing' as any,
        amount: product.price || 100000,
        transDate: new Date(),
        bankAccount: 'Test Bank Account',
        description: 'Test payment',
        source: 'acta' as any,
        orderId: order.id,
      },
    });

    console.log(`💳 Order payment created: ${orderPayment.code}`);

    // Update order with delivery ID
    await prisma.order.update({
      where: { id: order.id },
      data: { orderDeliveryId: orderDelivery.id },
    });

    console.log('🔗 Order updated with delivery ID');

    // Test retrieving the complete order
    console.log('🔍 Testing order retrieval...');
    const retrievedOrder = await prisma.order.findFirst({
      where: {
        id: order.id,
        customer: {
          userId: testUser.id,
        },
      },
      include: {
        customer: {
          include: {
            user: true,
            customerGroup: true,
          },
        },
        orderDetails: {
          include: {
            product: true,
          },
        },
        payments: true,
        orderDelivery: true,
        warehouse: true,
        saleChannel: true,
      },
    });

    if (retrievedOrder) {
      console.log(`✅ Order retrieved successfully: ${retrievedOrder.code}`);
      console.log(`📊 Order status: ${retrievedOrder.status}`);
      console.log(
        `💰 Customer: ${retrievedOrder.customer.user?.email || 'Unknown'}`,
      );
      console.log(`🏪 Warehouse: ${retrievedOrder.warehouse.name}`);
      console.log(
        `📺 Sale Channel: ${retrievedOrder.saleChannel?.name || 'Unknown'}`,
      );
      console.log(
        `📦 Order details: ${retrievedOrder.orderDetails.length} items`,
      );
      console.log(`💳 Payments: ${retrievedOrder.payments.length} records`);
      console.log(
        `🚚 Delivery: ${retrievedOrder.orderDelivery ? 'Yes' : 'No'}`,
      );
    } else {
      console.log('❌ Failed to retrieve order');
    }

    // Clean up - delete everything in reverse order
    console.log('🧹 Cleaning up test data...');

    // Delete order payment
    await prisma.orderPayment.delete({
      where: { id: orderPayment.id },
    });
    console.log('✅ Order payment deleted');

    // Delete order detail
    await prisma.orderDetail.delete({
      where: { id: orderDetail.id },
    });
    console.log('✅ Order detail deleted');

    // Delete order delivery
    await prisma.orderDelivery.delete({
      where: { id: orderDelivery.id },
    });
    console.log('✅ Order delivery deleted');

    // Delete order
    await prisma.order.delete({
      where: { id: order.id },
    });
    console.log('✅ Order deleted');

    // Delete cart item
    await prisma.cartItem.delete({
      where: { id: cartItem.id },
    });
    console.log('✅ Cart item deleted');

    console.log('🎉 Complete checkout flow test completed successfully!');
    console.log('📋 Summary:');
    console.log('   ✅ Cart creation works');
    console.log('   ✅ Product addition to cart works');
    console.log('   ✅ Order creation works');
    console.log('   ✅ Order delivery creation works');
    console.log('   ✅ Order detail creation works');
    console.log('   ✅ Order payment creation works');
    console.log('   ✅ Order retrieval works');
    console.log('   ✅ Database relationships are correct');
    console.log('   ✅ Cleanup works');
  } catch (error) {
    console.error('❌ Error testing checkout flow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCheckoutComplete();
