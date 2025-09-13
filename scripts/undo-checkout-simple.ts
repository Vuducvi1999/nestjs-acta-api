#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function undoOrder(orderId: string) {
  try {
    console.log(`🔄 Starting to undo order: ${orderId}`);

    // Find the order first
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        orderDetails: true,
        orderDelivery: true,
      },
    });

    if (!order) {
      console.error(`❌ Order ${orderId} not found`);
      return;
    }

    console.log(`📋 Found order: ${order.code}`);
    console.log(`💰 Total amount: ${order.payments?.[0]?.amount || 'N/A'}`);
    console.log(`📦 Items count: ${order.orderDetails?.length || 0}`);

    // Delete in the correct order to avoid foreign key constraints
    console.log('🗑️  Deleting related data...');

    // 1. Delete order payments first
    await prisma.orderPayment.deleteMany({
      where: { orderId },
    });
    console.log('✅ Deleted order payments');

    // 2. Delete order delivery
    if (order.orderDelivery) {
      await prisma.orderDelivery.delete({
        where: { orderId },
      });
      console.log('✅ Deleted order delivery');
    }

    // 3. Delete order details
    await prisma.orderDetail.deleteMany({
      where: { orderId },
    });
    console.log('✅ Deleted order details');

    // 4. Finally delete the order
    await prisma.order.delete({
      where: { id: orderId },
    });
    console.log('✅ Deleted order');

    console.log(`🎉 Successfully undone order: ${orderId}`);
    console.log(`📊 Summary:`);
    console.log(`   - Order: ${order.code}`);
    console.log(`   - Items: ${order.orderDetails?.length || 0}`);
    console.log(`   - Payments: ${order.payments?.length || 0}`);
    console.log(`   - Delivery: ${order.orderDelivery ? 'Yes' : 'No'}`);
  } catch (error) {
    console.error('❌ Error undoing order:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function listRecentOrders(limit: number = 10) {
  try {
    console.log(`📋 Listing recent orders (limit: ${limit})`);

    const orders = await prisma.order.findMany({
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        payments: true,
        orderDetails: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    if (orders.length === 0) {
      console.log('ℹ️  No orders found');
      return;
    }

    console.log(`\n📊 Recent Orders:`);
    console.log('─'.repeat(120));

    for (const order of orders) {
      const customerName =
        order.customer.user?.fullName ||
        order.customer.user?.email ||
        'Unknown';
      const itemCount = order.orderDetails?.length || 0;
      const totalAmount = order.payments?.[0]?.amount || 'N/A';

      console.log(
        `📦 ${order.code} | 👤 ${customerName} | 📦 ${itemCount} items | 💰 ${totalAmount} | ⏰ ${order.createdAt.toISOString()}`,
      );
    }

    console.log('─'.repeat(120));
  } catch (error) {
    console.error('❌ Error listing orders:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  ts-node scripts/undo-checkout-simple.ts list [limit]');
  console.log('  ts-node scripts/undo-checkout-simple.ts undo <orderId>');
  console.log('');
  console.log('Examples:');
  console.log('  ts-node scripts/undo-checkout-simple.ts list 5');
  console.log(
    '  ts-node scripts/undo-checkout-simple.ts undo cmeuu5yk80004zgrah90lcj73',
  );
} else if (args[0] === 'list') {
  const limit = parseInt(args[1]) || 10;
  listRecentOrders(limit);
} else if (args[0] === 'undo') {
  if (args[1]) {
    undoOrder(args[1]);
  } else {
    console.error('❌ Please provide an order ID');
  }
} else {
  console.error('❌ Unknown command. Use "list" or "undo"');
}
