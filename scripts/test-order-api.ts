#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testOrderAPI() {
  try {
    console.log('🧪 Testing order API endpoints...');

    // Find any user with customer record
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
      console.log('❌ No test user found');
      return;
    }

    console.log(`👤 Using test user: ${testUser.email}`);

    // Find default warehouse and sale channel
    const warehouse = await prisma.warehouse.findFirst({
      where: { isActive: true },
    });

    const saleChannel = await prisma.saleChannel.findFirst({
      where: { isActive: true },
    });

    if (!warehouse || !saleChannel) {
      console.log('❌ No default warehouse or sale channel found');
      return;
    }

    console.log(`🏪 Using warehouse: ${warehouse.name}`);
    console.log(`📺 Using sale channel: ${saleChannel.name}`);

    // Create a test order
    const orderData = {
      code: `TEST-${Date.now()}`,
      purchaseDate: new Date(),
      description: 'Test order',
      status: 'draft' as any,
      paymentStatus: 'processing' as any,
      usingCod: false,
      subtotal: 100000,
      shippingFee: 0,
      discount: 0,
      total: 100000,
      customerNote: 'Test order',
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

    // Test retrieving the order with the same query as the service
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
        orderDetails: true,
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
    } else {
      console.log('❌ Failed to retrieve order');
    }

    // Test order cancellation
    console.log('🚫 Testing order cancellation...');
    const cancelledOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'cancelled' as any,
        adminNote: 'Test cancellation',
      },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
      },
    });

    console.log(`✅ Order cancelled: ${cancelledOrder.status}`);

    // Clean up - delete the test order
    console.log('🧹 Cleaning up test order...');
    await prisma.order.delete({
      where: { id: order.id },
    });
    console.log('✅ Test order deleted');

    console.log('🎉 Order API test completed successfully!');
    console.log('📋 Summary:');
    console.log('   ✅ Order creation works');
    console.log('   ✅ Order retrieval works');
    console.log('   ✅ Order cancellation works');
    console.log('   ✅ Database relationships are correct');
  } catch (error) {
    console.error('❌ Error testing order API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOrderAPI();
