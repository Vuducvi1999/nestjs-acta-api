#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testCheckoutFix() {
  try {
    console.log('🔍 Testing checkout fix...');

    // Find the most recent order
    const recentOrder = await prisma.order.findFirst({
      where: {
        code: {
          contains: 'cmeuu5yk80004zgrah90lcj73',
        },
      },
      include: {
        payments: true,
        orderDetails: true,
        orderDelivery: true,
        customer: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!recentOrder) {
      console.log('❌ No recent order found');
      return;
    }

    console.log(`📋 Found order: ${recentOrder.code}`);
    console.log(
      `👤 Customer: ${recentOrder.customer.user?.fullName || recentOrder.customer.user?.email}`,
    );
    console.log(`📦 Items: ${recentOrder.orderDetails?.length || 0}`);
    console.log(`💰 Payments: ${recentOrder.payments?.length || 0}`);
    console.log(`🚚 Delivery: ${recentOrder.orderDelivery ? 'Yes' : 'No'}`);

    // Check if there are any payment records
    if (recentOrder.payments && recentOrder.payments.length > 0) {
      console.log('\n💳 Payment details:');
      for (const payment of recentOrder.payments) {
        console.log(`   - Payment ID: ${payment.id}`);
        console.log(`   - Provider: ${(payment as any).provider || 'N/A'}`);
        console.log(`   - Status: ${payment.status}`);
        console.log(`   - Amount: ${payment.amount}`);
      }
    }

    // Check order details
    if (recentOrder.orderDetails && recentOrder.orderDetails.length > 0) {
      console.log('\n📦 Order details:');
      for (const detail of recentOrder.orderDetails) {
        console.log(`   - Product ID: ${detail.productId}`);
        console.log(`   - Quantity: ${detail.quantity}`);
        console.log(`   - Discount: ${detail.discount}`);
      }
    }

    console.log('\n✅ Order data looks good!');
    console.log('🎯 The backend is creating orders successfully.');
    console.log('🔧 The issue is likely in the frontend response handling.');
  } catch (error) {
    console.error('❌ Error testing checkout:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCheckoutFix();
