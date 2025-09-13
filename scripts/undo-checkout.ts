#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { Command } from 'commander';

const prisma = new PrismaClient();

const program = new Command();

program
  .name('undo-checkout')
  .description(
    'Undo checkout process - delete order and related data (DEV ONLY)',
  )
  .version('1.0.0');

program
  .command('order <orderId>')
  .description('Undo a specific order by ID')
  .action(async (orderId: string) => {
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
        console.log(`ℹ️  Order ${orderId} not found`);

        // Check for orphaned payments even if order doesn't exist
        console.log('🔍 Checking for orphaned payments...');
        const orphanedPaymentCount = await prisma.payment.count({
          where: {
            orderPayment: null,
            invoicePayment: null,
          },
        });

        if (orphanedPaymentCount > 0) {
          console.log(`⚠️  Found ${orphanedPaymentCount} orphaned payments`);
          console.log('🗑️  Cleaning orphaned payments...');

          // Delete orphaned payment transactions
          await prisma.paymentTransaction.deleteMany({
            where: {
              payment: {
                orderPayment: null,
                invoicePayment: null,
              },
            },
          });

          // Delete orphaned payment attempts
          await prisma.paymentAttempt.deleteMany({
            where: {
              payment: {
                orderPayment: null,
                invoicePayment: null,
              },
            },
          });

          // Delete orphaned payments
          await prisma.payment.deleteMany({
            where: {
              orderPayment: null,
              invoicePayment: null,
            },
          });

          console.log(`✅ Cleaned ${orphanedPaymentCount} orphaned payments`);
        } else {
          console.log('ℹ️  No orphaned payments found');
        }

        process.exit(1);
      }

      console.log(`📋 Found order: ${order.code}`);
      console.log(`💰 Total amount: ${order.payments?.[0]?.amount || 'N/A'}`);
      console.log(`📦 Items count: ${order.orderDetails?.length || 0}`);

      // Delete in the correct order to avoid foreign key constraints
      console.log('🗑️  Deleting related data...');

      // 1. Delete payments first (if any)
      if (order.payments && order.payments.length > 0) {
        for (const payment of order.payments) {
          try {
            // Delete payment transactions
            await prisma.paymentTransaction.deleteMany({
              where: { paymentId: payment.id },
            });

            // Delete payment attempts
            await prisma.paymentAttempt.deleteMany({
              where: { paymentId: payment.id },
            });

            // Delete the payment
            await prisma.payment.delete({
              where: { id: payment.id },
            });
          } catch (error) {
            console.log(
              `⚠️  Payment ${payment.id} already deleted or not found`,
            );
          }
        }
        console.log(`✅ Processed ${order.payments.length} payment(s)`);
      }

      // 2. Delete order payments
      await prisma.orderPayment.deleteMany({
        where: { orderId },
      });
      console.log('✅ Deleted order payments');

      // 3. Delete order delivery
      if (order.orderDelivery) {
        await prisma.orderDelivery.delete({
          where: { orderId },
        });
        console.log('✅ Deleted order delivery');
      }

      // 4. Delete commission summaries first (they reference order details)
      await prisma.commissionSummary.deleteMany({
        where: {
          orderDetail: { orderId },
        },
      });
      console.log('✅ Deleted commission summaries');

      // 5. Delete affiliate commissions (they also reference order details)
      await prisma.affiliateCommission.deleteMany({
        where: { orderId },
      });
      console.log('✅ Deleted affiliate commissions');

      // 6. Delete order orderDetails
      await prisma.orderDetail.deleteMany({
        where: { orderId },
      });
      console.log('✅ Deleted order details');

      // 7. Delete invoice order surcharges (they reference order)
      await prisma.invoiceOrderSurcharge.deleteMany({
        where: { orderId },
      });
      console.log('✅ Deleted invoice order surcharges');

      // 8. Delete invoice payments (they reference invoice)
      await prisma.invoicePayment.deleteMany({
        where: {
          invoice: { orderId },
        },
      });
      console.log('✅ Deleted invoice payments');

      // 9. Delete invoice details (they reference invoice)
      await prisma.invoiceDetail.deleteMany({
        where: {
          invoice: { orderId },
        },
      });
      console.log('✅ Deleted invoice details');

      // 10. Delete invoices (they reference order)
      await prisma.invoice.deleteMany({
        where: { orderId },
      });
      console.log('✅ Deleted invoices');

      // 11. Finally delete the order
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
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command('user <userId>')
  .description('Undo all orders for a specific user')
  .option('-l, --limit <number>', 'Limit number of orders to undo', '10')
  .action(async (userId: string, options: { limit: string }) => {
    try {
      const limit = parseInt(options.limit);
      console.log(
        `🔄 Starting to undo orders for user: ${userId} (limit: ${limit})`,
      );

      // Find all orders for the user
      const orders = await prisma.order.findMany({
        where: {
          customer: {
            userId,
          },
        },
        include: {
          customer: true,
          payments: true,
          orderDetails: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      if (orders.length === 0) {
        console.log(`ℹ️  No orders found for user: ${userId}`);

        // Check for orphaned payments even if no orders exist
        console.log('🔍 Checking for orphaned payments...');
        const orphanedPaymentCount = await prisma.payment.count({
          where: {
            orderPayment: null,
            invoicePayment: null,
          },
        });

        if (orphanedPaymentCount > 0) {
          console.log(`⚠️  Found ${orphanedPaymentCount} orphaned payments`);
          console.log('🗑️  Cleaning orphaned payments...');

          // Delete orphaned payment transactions
          await prisma.paymentTransaction.deleteMany({
            where: {
              payment: {
                orderPayment: null,
                invoicePayment: null,
              },
            },
          });

          // Delete orphaned payment attempts
          await prisma.paymentAttempt.deleteMany({
            where: {
              payment: {
                orderPayment: null,
                invoicePayment: null,
              },
            },
          });

          // Delete orphaned payments
          await prisma.payment.deleteMany({
            where: {
              orderPayment: null,
              invoicePayment: null,
            },
          });

          console.log(`✅ Cleaned ${orphanedPaymentCount} orphaned payments`);
        } else {
          console.log('ℹ️  No orphaned payments found');
        }

        return;
      }

      console.log(`📋 Found ${orders.length} orders for user`);

      let successCount = 0;
      let errorCount = 0;

      for (const order of orders) {
        try {
          console.log(`\n🔄 Processing order: ${order.code}`);

          // Delete payments first
          if (order.payments && order.payments.length > 0) {
            for (const payment of order.payments) {
              try {
                await prisma.paymentTransaction.deleteMany({
                  where: { paymentId: payment.id },
                });
                await prisma.paymentAttempt.deleteMany({
                  where: { paymentId: payment.id },
                });
                await prisma.payment.delete({
                  where: { id: payment.id },
                });
              } catch (error) {
                console.log(
                  `⚠️  Payment ${payment.id} already deleted or not found`,
                );
              }
            }
          }

          // Delete order payments
          await prisma.orderPayment.deleteMany({
            where: { orderId: order.id },
          });

          // Delete order delivery
          await prisma.orderDelivery.deleteMany({
            where: { orderId: order.id },
          });

          // Delete commission summaries first (they reference order details)
          await prisma.commissionSummary.deleteMany({
            where: {
              orderDetail: { orderId: order.id },
            },
          });

          // Delete affiliate commissions (they also reference order details)
          await prisma.affiliateCommission.deleteMany({
            where: { orderId: order.id },
          });

          // Delete order details
          await prisma.orderDetail.deleteMany({
            where: { orderId: order.id },
          });

          // Delete invoice order surcharges (they reference order)
          await prisma.invoiceOrderSurcharge.deleteMany({
            where: { orderId: order.id },
          });

          // Delete invoice payments (they reference invoice)
          await prisma.invoicePayment.deleteMany({
            where: {
              invoice: { orderId: order.id },
            },
          });

          // Delete invoice details (they reference invoice)
          await prisma.invoiceDetail.deleteMany({
            where: {
              invoice: { orderId: order.id },
            },
          });

          // Delete invoices (they reference order)
          await prisma.invoice.deleteMany({
            where: { orderId: order.id },
          });

          // Delete the order
          await prisma.order.delete({
            where: { id: order.id },
          });

          console.log(`✅ Successfully undone order: ${order.code}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Error undoing order ${order.code}:`, error);
          errorCount++;
        }
      }

      console.log(`\n📊 Summary:`);
      console.log(`   - Total orders processed: ${orders.length}`);
      console.log(`   - Successfully undone: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);
    } catch (error) {
      console.error('❌ Error undoing user orders:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command('recent <hours>')
  .description('Undo all orders created in the last N hours')
  .option('-l, --limit <number>', 'Limit number of orders to undo', '50')
  .action(async (hours: string, options: { limit: string }) => {
    try {
      const hoursNum = parseInt(hours);
      const limit = parseInt(options.limit);
      const cutoffTime = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

      console.log(
        `🔄 Starting to undo orders created in the last ${hours} hours (limit: ${limit})`,
      );
      console.log(`⏰ Cutoff time: ${cutoffTime.toISOString()}`);

      // Find recent orders
      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: cutoffTime,
          },
        },
        include: {
          customer: true,
          payments: true,
          orderDetails: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      if (orders.length === 0) {
        console.log(`ℹ️  No orders found in the last ${hours} hours`);

        // Check for orphaned payments even if no recent orders exist
        console.log('🔍 Checking for orphaned payments...');
        const orphanedPaymentCount = await prisma.payment.count({
          where: {
            orderPayment: null,
            invoicePayment: null,
          },
        });

        if (orphanedPaymentCount > 0) {
          console.log(`⚠️  Found ${orphanedPaymentCount} orphaned payments`);
          console.log('🗑️  Cleaning orphaned payments...');

          // Delete orphaned payment transactions
          await prisma.paymentTransaction.deleteMany({
            where: {
              payment: {
                orderPayment: null,
                invoicePayment: null,
              },
            },
          });

          // Delete orphaned payment attempts
          await prisma.paymentAttempt.deleteMany({
            where: {
              payment: {
                orderPayment: null,
                invoicePayment: null,
              },
            },
          });

          // Delete orphaned payments
          await prisma.payment.deleteMany({
            where: {
              orderPayment: null,
              invoicePayment: null,
            },
          });

          console.log(`✅ Cleaned ${orphanedPaymentCount} orphaned payments`);
        } else {
          console.log('ℹ️  No orphaned payments found');
        }

        return;
      }

      console.log(`📋 Found ${orders.length} recent orders`);

      let successCount = 0;
      let errorCount = 0;

      for (const order of orders) {
        try {
          console.log(
            `\n🔄 Processing order: ${order.code} (${order.createdAt.toISOString()})`,
          );

          // Delete payments first
          if (order.payments && order.payments.length > 0) {
            for (const payment of order.payments) {
              try {
                await prisma.paymentTransaction.deleteMany({
                  where: { paymentId: payment.id },
                });
                await prisma.paymentAttempt.deleteMany({
                  where: { paymentId: payment.id },
                });
                await prisma.payment.delete({
                  where: { id: payment.id },
                });
              } catch (error) {
                console.log(
                  `⚠️  Payment ${payment.id} already deleted or not found`,
                );
              }
            }
          }

          // Delete order payments
          await prisma.orderPayment.deleteMany({
            where: { orderId: order.id },
          });

          // Delete order delivery
          await prisma.orderDelivery.deleteMany({
            where: { orderId: order.id },
          });

          // Delete commission summaries first (they reference order details)
          await prisma.commissionSummary.deleteMany({
            where: {
              orderDetail: { orderId: order.id },
            },
          });

          // Delete affiliate commissions (they also reference order details)
          await prisma.affiliateCommission.deleteMany({
            where: { orderId: order.id },
          });

          // Delete order details
          await prisma.orderDetail.deleteMany({
            where: { orderId: order.id },
          });

          // Delete invoice order surcharges (they reference order)
          await prisma.invoiceOrderSurcharge.deleteMany({
            where: { orderId: order.id },
          });

          // Delete invoice payments (they reference invoice)
          await prisma.invoicePayment.deleteMany({
            where: {
              invoice: { orderId: order.id },
            },
          });

          // Delete invoice details (they reference invoice)
          await prisma.invoiceDetail.deleteMany({
            where: {
              invoice: { orderId: order.id },
            },
          });

          // Delete invoices (they reference order)
          await prisma.invoice.deleteMany({
            where: { orderId: order.id },
          });

          // Delete the order
          await prisma.order.delete({
            where: { id: order.id },
          });

          console.log(`✅ Successfully undone order: ${order.code}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Error undoing order ${order.code}:`, error);
          errorCount++;
        }
      }

      console.log(`\n📊 Summary:`);
      console.log(`   - Total orders processed: ${orders.length}`);
      console.log(`   - Successfully undone: ${successCount}`);
      console.log(`   - Errors: ${errorCount}`);
    } catch (error) {
      console.error('❌ Error undoing recent orders:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command('payments')
  .description('Clean all payments if they exist (DEV ONLY)')
  .option('-f, --force', 'Force deletion without confirmation', false)
  .action(async (options: { force: boolean }) => {
    try {
      console.log('🔄 Starting to clean all payments...');

      // Count existing payments from payment.prisma schema
      const paymentCount = await prisma.payment.count();
      const paymentTransactionCount = await prisma.paymentTransaction.count();
      const paymentAttemptCount = await prisma.paymentAttempt.count();
      const walletCount = await prisma.wallet.count();
      const walletLedgerCount = await prisma.walletLedger.count();
      const payoutCount = await prisma.payout.count();

      // Count related payment tables
      const orderPaymentCount = await prisma.orderPayment.count();
      const invoicePaymentCount = await prisma.invoicePayment.count();
      const returnOrderPaymentCount = await prisma.returnOrderPayment.count();
      const purchaseOrderPaymentCount =
        await prisma.purchaseOrderPayment.count();

      const totalCount =
        paymentCount +
        paymentTransactionCount +
        paymentAttemptCount +
        walletCount +
        walletLedgerCount +
        payoutCount +
        orderPaymentCount +
        invoicePaymentCount +
        returnOrderPaymentCount +
        purchaseOrderPaymentCount;

      if (totalCount === 0) {
        console.log('ℹ️  No payments found to clean');
        return;
      }

      console.log(`📊 Found payments to clean:`);
      console.log(`   Core Payment Tables (payment.prisma):`);
      console.log(`     - Payments: ${paymentCount}`);
      console.log(`     - Payment Transactions: ${paymentTransactionCount}`);
      console.log(`     - Payment Attempts: ${paymentAttemptCount}`);
      console.log(`     - Wallets: ${walletCount}`);
      console.log(`     - Wallet Ledger: ${walletLedgerCount}`);
      console.log(`     - Payouts: ${payoutCount}`);
      console.log(`   Related Payment Tables:`);
      console.log(`     - Order Payments: ${orderPaymentCount}`);
      console.log(`     - Invoice Payments: ${invoicePaymentCount}`);
      console.log(`     - Return Order Payments: ${returnOrderPaymentCount}`);
      console.log(
        `     - Purchase Order Payments: ${purchaseOrderPaymentCount}`,
      );
      console.log(`   Total records: ${totalCount}`);

      if (!options.force) {
        console.log(
          '\n⚠️  WARNING: This will permanently delete ALL payment-related data from the database!',
        );
        console.log(
          '   This includes payments, wallets, payouts, and all payment records.',
        );
        console.log('   Use --force flag to proceed without confirmation.');
        return;
      }

      console.log('\n🗑️  Cleaning all payment data...');

      // Delete in the correct order to avoid foreign key constraints

      // 1. Delete payment transactions first (depends on Payment)
      if (paymentTransactionCount > 0) {
        await prisma.paymentTransaction.deleteMany({});
        console.log(
          `✅ Deleted ${paymentTransactionCount} payment transactions`,
        );
      }

      // 2. Delete payment attempts (depends on Payment)
      if (paymentAttemptCount > 0) {
        await prisma.paymentAttempt.deleteMany({});
        console.log(`✅ Deleted ${paymentAttemptCount} payment attempts`);
      }

      // 3. Delete wallet ledger (depends on Wallet)
      if (walletLedgerCount > 0) {
        await prisma.walletLedger.deleteMany({});
        console.log(`✅ Deleted ${walletLedgerCount} wallet ledger entries`);
      }

      // 4. Delete order payments (depends on Order)
      if (orderPaymentCount > 0) {
        await prisma.orderPayment.deleteMany({});
        console.log(`✅ Deleted ${orderPaymentCount} order payments`);
      }

      // 5. Delete invoice payments (depends on Invoice)
      if (invoicePaymentCount > 0) {
        await prisma.invoicePayment.deleteMany({});
        console.log(`✅ Deleted ${invoicePaymentCount} invoice payments`);
      }

      // 6. Delete return order payments (depends on ReturnOrder)
      if (returnOrderPaymentCount > 0) {
        await prisma.returnOrderPayment.deleteMany({});
        console.log(
          `✅ Deleted ${returnOrderPaymentCount} return order payments`,
        );
      }

      // 7. Delete purchase order payments (depends on PurchaseOrder)
      if (purchaseOrderPaymentCount > 0) {
        await prisma.purchaseOrderPayment.deleteMany({});
        console.log(
          `✅ Deleted ${purchaseOrderPaymentCount} purchase order payments`,
        );
      }

      // 8. Delete payouts (depends on User)
      if (payoutCount > 0) {
        await prisma.payout.deleteMany({});
        console.log(`✅ Deleted ${payoutCount} payouts`);
      }

      // 9. Delete wallets (depends on User)
      if (walletCount > 0) {
        await prisma.wallet.deleteMany({});
        console.log(`✅ Deleted ${walletCount} wallets`);
      }

      // 10. Finally delete payments (main table)
      if (paymentCount > 0) {
        await prisma.payment.deleteMany({});
        console.log(`✅ Deleted ${paymentCount} payments`);
      }

      console.log('\n🎉 Successfully cleaned all payment data!');
      console.log(`📊 Summary:`);
      console.log(`   Core Payment Tables:`);
      console.log(`     - Payments deleted: ${paymentCount}`);
      console.log(
        `     - Payment Transactions deleted: ${paymentTransactionCount}`,
      );
      console.log(`     - Payment Attempts deleted: ${paymentAttemptCount}`);
      console.log(`     - Wallets deleted: ${walletCount}`);
      console.log(`     - Wallet Ledger deleted: ${walletLedgerCount}`);
      console.log(`     - Payouts deleted: ${payoutCount}`);
      console.log(`   Related Payment Tables:`);
      console.log(`     - Order Payments deleted: ${orderPaymentCount}`);
      console.log(`     - Invoice Payments deleted: ${invoicePaymentCount}`);
      console.log(
        `     - Return Order Payments deleted: ${returnOrderPaymentCount}`,
      );
      console.log(
        `     - Purchase Order Payments deleted: ${purchaseOrderPaymentCount}`,
      );
      console.log(`   Total records deleted: ${totalCount}`);
    } catch (error) {
      console.error('❌ Error cleaning payments:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

program
  .command('list')
  .description('List recent orders (for reference)')
  .option('-l, --limit <number>', 'Number of orders to list', '10')
  .action(async (options: { limit: string }) => {
    try {
      const limit = parseInt(options.limit);
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
        const paymentCount = order.payments?.length || 0;
        const totalAmount = order.payments?.[0]?.amount || 'N/A';

        console.log(
          `📦 ${order.code} | 👤 ${customerName} | 📦 ${itemCount} items | 💰 ${totalAmount} | ⏰ ${order.createdAt.toISOString()}`,
        );
      }

      console.log('─'.repeat(120));
    } catch (error) {
      console.error('❌ Error listing orders:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Add help text
program.addHelpText(
  'after',
  `

Examples:
  $ ts-node scripts/undo-checkout.ts order cmeuu5yk80004zgrah90lcj73
  $ ts-node scripts/undo-checkout.ts user 41fe4f8a-5622-4358-93c9-e94cd69187e5 --limit 5
  $ ts-node scripts/undo-checkout.ts recent 2 --limit 20
  $ ts-node scripts/undo-checkout.ts list --limit 15
  $ ts-node scripts/undo-checkout.ts payments --force

⚠️  WARNING: This script is for DEVELOPMENT USE ONLY!
   It will permanently delete orders and related data from the database.
   Make sure you have backups before running this script.
`,
);

program.parse(process.argv);
