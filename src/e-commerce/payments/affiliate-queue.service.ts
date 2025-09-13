import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CommissionLevel,
  CommissionStatus,
  CategoryGroup,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
} from '@prisma/client';

enum AffiliateJobType {
  ORDER_COMPLETED = 'order_completed',
}

enum CommissionRate {
  PLATFORM_CUT = 0.1, // 10% platform cut from total price
  CUSTOMER_SHARE = 0.5, // 50% for customer (F2)
  DEPTH1_SHARE = 0.3, // 30% for depth 1 (F1)
  DEPTH2_SHARE = 0.2, // 20% for depth 2 (F0)
}

interface AffiliateJob {
  id: string;
  type: AffiliateJobType;
  payload: {
    orderId: string;
  };
  createdAt: Date;
  retryCount: number;
  maxRetries: number;
}

@Injectable()
export class AffiliateQueueService {
  private readonly logger = new Logger(AffiliateQueueService.name);
  private readonly queue: AffiliateJob[] = [];
  private readonly processing = new Set<string>();
  private readonly batchSize = 10;
  private readonly processingInterval = 1000;

  constructor(private readonly prisma: PrismaService) {
    this.startProcessing();
  }

  async enqueueOrderCompleted(orderId: string): Promise<void> {
    const job: AffiliateJob = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type: AffiliateJobType.ORDER_COMPLETED,
      payload: { orderId },
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };
    this.queue.push(job);
    this.logger.log(`Enqueued affiliate job: order_completed for ${orderId}`);
  }

  private startProcessing(): void {
    setInterval(async () => {
      if (this.queue.length === 0) return;
      const batch = this.queue.splice(0, this.batchSize);
      for (const job of batch) {
        if (this.processing.has(job.id)) continue;
        this.processing.add(job.id);
        this.processJob(job).finally(() => this.processing.delete(job.id));
      }
    }, this.processingInterval);
  }

  private async processJob(job: AffiliateJob): Promise<void> {
    try {
      if (job.type === AffiliateJobType.ORDER_COMPLETED) {
        await this.processOrderCompleted(job.payload.orderId);
      }
    } catch (error) {
      this.logger.error(
        `Failed affiliate job ${job.id}: ${(error as Error).message}`,
      );
      if (job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.createdAt = new Date();
        setTimeout(
          () => this.queue.push(job),
          Math.pow(2, job.retryCount) * 1000,
        );
      }
    }
  }

  private async processOrderCompleted(orderId: string): Promise<void> {
    this.logger.log(`Processing affiliate commission for order ${orderId}`);

    // Wrap entire operation in a transaction to ensure data consistency
    // This ensures atomicity - either all operations succeed or all are rolled back
    await this.prisma.$transaction(async (tx) => {
      // Get order details with products and categories
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          orderDetails: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          customer: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (!order.orderDetails || order.orderDetails.length === 0) {
        this.logger.warn(`Order ${orderId} has no products`);
        return;
      }

      // Get customer user ID (the actual user ID, not customer ID)
      const customerUserId = order.customer.userId;
      if (!customerUserId) {
        this.logger.warn(`Order ${orderId} has no customer user ID`);
        return;
      }

      // Get customer's referenceId to query closure table
      const customerUser = await tx.user.findUnique({
        where: { id: customerUserId },
        select: { referenceId: true },
      });

      if (!customerUser) {
        this.logger.warn(`Customer user ${customerUserId} not found`);
        return;
      }

      // Get referral hierarchy (depth 1 and 2) using referenceId
      const referralHierarchy = await tx.userReferralClosure.findMany({
        where: {
          descendantId: customerUser.referenceId, // Use referenceId here
          depth: { in: [1, 2] },
        },
        select: {
          ancestorId: true, // This returns referenceId of ancestors
          depth: true,
        },
      });

      // Group by depth
      const depth1Referrals = referralHierarchy.filter((r) => r.depth === 1);
      const depth2Referrals = referralHierarchy.filter((r) => r.depth === 2);

      // Convert referenceIds to userIds for commission creation
      const depth1ReferenceIds = depth1Referrals.map((r) => r.ancestorId);
      const depth2ReferenceIds = depth2Referrals.map((r) => r.ancestorId);

      // Get actual user IDs from reference IDs
      const [depth1Users, depth2Users] = await Promise.all([
        depth1ReferenceIds.length > 0
          ? tx.user.findMany({
              where: { referenceId: { in: depth1ReferenceIds } },
              select: { id: true, referenceId: true },
            })
          : [],
        depth2ReferenceIds.length > 0
          ? tx.user.findMany({
              where: { referenceId: { in: depth2ReferenceIds } },
              select: { id: true, referenceId: true },
            })
          : [],
      ]);

      // Only create commissions if there are referrers
      if (depth1Users.length === 0 && depth2Users.length === 0) {
        this.logger.log(
          `No referrers found for order ${orderId}, skipping commission creation`,
        );
        return;
      }

      // Process each order detail (product)
      const commissionPromises = order.orderDetails.map(async (orderDetail) => {
        const product = orderDetail.product;
        const category = product.category;

        if (!category) {
          this.logger.warn(`Product ${product.id} has no category`);
          return;
        }

        // Get category group commission rate (e.g., Group C = 50%)
        const categoryGroupRate = this.getCategoryGroupRate(category.group);

        // Calculate base amount for this product
        const baseAmount = Number(orderDetail.quantity) * Number(product.price);

        // Platform cut = 10% of total price
        const platformCut = baseAmount * CommissionRate.PLATFORM_CUT;

        // Commission pool = categoryGroupRate * baseAmount (e.g., 50% of product price)
        const commissionPool = baseAmount * categoryGroupRate;

        // Available commission = commission pool - platform cut (e.g., 50% - 10% = 40%)
        const availableCommission = commissionPool - platformCut;

        // Calculate commission amounts from available commission
        const customerCommission =
          availableCommission * CommissionRate.CUSTOMER_SHARE;
        const depth1Commission =
          availableCommission * CommissionRate.DEPTH1_SHARE;
        const depth2Commission =
          availableCommission * CommissionRate.DEPTH2_SHARE;

        // Create commission records
        const commissionRecords: any[] = [];

        // F2 - Customer (50% of available commission)
        const customerRecord = {
          orderId,
          orderDetailId: orderDetail.id, // Link to OrderDetail
          productId: product.id,
          beneficiaryId: customerUserId,
          commissionLevel: CommissionLevel.F2,
          commissionRate: CommissionRate.CUSTOMER_SHARE,
          baseAmount: availableCommission,
          quantity: orderDetail.quantity,
          commissionAmount: customerCommission,
          categoryId: category.id,
          status: CommissionStatus.calculated,
        };
        commissionRecords.push(customerRecord);

        // F1 - Depth 1 referrals (30% of available commission)
        for (const user of depth1Users) {
          const f1Record = {
            orderId,
            orderDetailId: orderDetail.id, // Link to OrderDetail
            productId: product.id,
            beneficiaryId: user.id, // Use actual user ID
            commissionLevel: CommissionLevel.F1,
            commissionRate: CommissionRate.DEPTH1_SHARE,
            baseAmount: availableCommission,
            quantity: orderDetail.quantity,
            commissionAmount: depth1Commission,
            categoryId: category.id,
            status: CommissionStatus.calculated,
          };
          commissionRecords.push(f1Record);
        }

        // F0 - Depth 2 referrals (20% of available commission)
        for (const user of depth2Users) {
          const f0Record = {
            orderId,
            orderDetailId: orderDetail.id, // Link to OrderDetail
            productId: product.id,
            beneficiaryId: user.id, // Use actual user ID
            commissionLevel: CommissionLevel.F0,
            commissionRate: CommissionRate.DEPTH2_SHARE,
            baseAmount: availableCommission,
            quantity: orderDetail.quantity,
            commissionAmount: depth2Commission,
            categoryId: category.id,
            status: CommissionStatus.calculated,
          };
          commissionRecords.push(f0Record);
        }

        return commissionRecords;
      });

      // Wait for all commission calculations
      const allCommissions = await Promise.all(commissionPromises);
      const flatCommissions = allCommissions
        .flat()
        .filter((comm): comm is any => comm !== undefined);

      if (flatCommissions.length === 0) {
        this.logger.warn(`No commissions to create for order ${orderId}`);
        return;
      }

      // Create commission records in database
      const createdCommissions = await Promise.all(
        flatCommissions.map(async (commission) => {
          return await tx.affiliateCommission.create({
            data: commission,
          });
        }),
      );

      // Create Commission Summaries for each order detail
      await this.createCommissionSummaries(order, createdCommissions, tx);

      // Create commission log
      const totalCommissionAmount = flatCommissions.reduce(
        (sum, comm) => sum + Number(comm.commissionAmount),
        0,
      );

      await tx.affiliateCommissionLog.create({
        data: {
          orderId,
          totalCommissionAmount,
          commissionCount: flatCommissions.length,
          calculationStatus: 'completed',
          notes: `Affiliate commissions calculated for order ${orderId}`,
        },
      });

      // Clear cart items for purchased products
      const productIds = order.orderDetails.map((detail) => detail.productId);

      const deletedCartItems = await tx.cartItem.deleteMany({
        where: {
          cart: {
            userId: customerUserId,
          },
          productId: {
            in: productIds,
          },
        },
      });
      this.logger.log(
        `Cleared ${deletedCartItems.count} cart items for user ${customerUserId}`,
      );

      // Create Invoice and InvoicePayments
      await this.createInvoiceFromOrder(order, tx);

      // Update order payment status to paid
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'paid',
          paidAt: new Date(),
        },
      });

      this.logger.log(
        `Updated order ${orderId} payment status to paid and created ${flatCommissions.length} affiliate commissions, total amount: ${totalCommissionAmount}`,
      );
    }); // End transaction
  }

  private async createInvoiceFromOrder(order: any, tx: any): Promise<void> {
    try {
      // Generate unique invoice code
      const invoiceCode = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      // Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          code: invoiceCode,
          purchaseDate: new Date(),
          status: InvoiceStatus.completed, // Order is already completed
          usingCod: false, // Assuming not COD since order is completed
          source: 'acta',
          orderId: order.id,
          customerId: order.customerId,
          warehouseId:
            order.warehouseId || (await this.getDefaultWarehouseId(tx)),
          soldById: order.soldById || (await this.getDefaultBusinessId(tx)),
        },
      });

      // Create Invoice Details
      const invoiceDetailsPromises = order.orderDetails.map(
        async (orderDetail: any) => {
          const invoiceDetail = await tx.invoiceDetail.create({
            data: {
              invoiceId: invoice.id,
              productId: orderDetail.productId,
              categoryId: orderDetail.product.categoryId,
              quantity: orderDetail.quantity,
              discount: 0, // No discount for now
              source: 'acta',
            },
          });
          return invoiceDetail;
        },
      );

      await Promise.all(invoiceDetailsPromises);

      // Calculate total amount from order details
      const totalAmount = order.orderDetails.reduce(
        (sum: number, detail: any) => {
          const productPrice = Number(detail.product.price) || 0;
          const quantity = Number(detail.quantity) || 0;
          return sum + productPrice * quantity;
        },
        0,
      );

      // Create Invoice Payment based on Order Payment
      if (order.orderPayments && order.orderPayments.length > 0) {
        const invoicePaymentsPromises = order.orderPayments.map(
          async (orderPayment: any) => {
            const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const paymentAmount = Number(orderPayment.amount) || totalAmount;

            const invoicePayment = await tx.invoicePayment.create({
              data: {
                code: paymentCode,
                invoiceId: invoice.id,
                amount: paymentAmount,
                method: orderPayment.method || PaymentMethod.transfer,
                status: PaymentStatus.paid, // Order payment is already successful
                transDate: new Date(),
                bankAccount: orderPayment.bankAccount || 'ACTA System',
                description: `Payment for order ${order.code}`,
                source: 'acta',
                paymentId: orderPayment.paymentId,
              },
            });
            return invoicePayment;
          },
        );

        await Promise.all(invoicePaymentsPromises);
      } else {
        // Create default payment if no order payments exist
        const defaultPaymentCode = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

        const defaultInvoicePayment = await tx.invoicePayment.create({
          data: {
            code: defaultPaymentCode,
            invoiceId: invoice.id,
            amount: totalAmount,
            method: PaymentMethod.transfer,
            status: PaymentStatus.paid,
            transDate: new Date(),
            bankAccount: 'ACTA System',
            description: `Payment for order ${order.code}`,
            source: 'acta',
          },
        });
      }

      this.logger.log(
        `Successfully created invoice ${invoiceCode} for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create invoice for order ${order.id}:`,
        error,
      );
      throw error;
    }
  }

  private async getDefaultWarehouseId(tx: any): Promise<string> {
    // Get first available warehouse - must exist
    const warehouse = await tx.warehouse.findFirst({
      where: { isActive: true },
    });

    if (!warehouse) {
      throw new Error(
        'No active warehouse found. Please create a warehouse first.',
      );
    }

    return warehouse.id;
  }

  private async getDefaultBusinessId(tx: any): Promise<string> {
    // Get first available business - must exist
    const business = await tx.business.findFirst();

    if (!business) {
      throw new Error('No business found. Please create a business first.');
    }

    return business.id;
  }

  private async createCommissionSummaries(
    order: any,
    createdCommissions: any[],
    tx: any,
  ): Promise<void> {
    // Group commissions by productId (order detail)
    const commissionsByProduct = new Map<string, any[]>();

    for (const commission of createdCommissions) {
      const productId = commission.productId;
      if (!commissionsByProduct.has(productId)) {
        commissionsByProduct.set(productId, []);
      }
      commissionsByProduct.get(productId)!.push(commission);
    }

    // Create Commission Summary for each order detail
    for (const orderDetail of order.orderDetails) {
      const productCommissions =
        commissionsByProduct.get(orderDetail.productId) || [];

      // Calculate total amount for this order detail
      const productPrice = Number(orderDetail.product.price) || 0;
      const quantity = Number(orderDetail.quantity) || 0;
      const totalAmount = productPrice * quantity;

      // Get category group rate
      const categoryGroupRate = this.getCategoryGroupRate(
        orderDetail.product.category.group,
      );

      // Calculate platform cut (10% of total)
      const platformCut = totalAmount * CommissionRate.PLATFORM_CUT;

      // Calculate commission pool
      const commissionPool = totalAmount * categoryGroupRate;

      // Calculate available commission after platform cut
      const availableCommission = commissionPool - platformCut;

      // Calculate total commission paid
      const commissionPaid = productCommissions.reduce(
        (sum, comm) => sum + Number(comm.commissionAmount),
        0,
      );

      // Calculate remaining amount (money not distributed due to missing referrers)
      const remainingAmount = availableCommission - commissionPaid;

      // Find commissions by level
      const f2Commission = productCommissions.find(
        (c) => c.commissionLevel === 'F2',
      );
      const f1Commission = productCommissions.find(
        (c) => c.commissionLevel === 'F1',
      );
      const f0Commission = productCommissions.find(
        (c) => c.commissionLevel === 'F0',
      );

      // Create Commission Summary
      await tx.commissionSummary.create({
        data: {
          orderDetailId: orderDetail.id,
          totalAmount,
          commissionPaid,
          platformCut,
          remainingAmount,
          categoryGroupRate,
          f2CommissionId: f2Commission?.id || null,
          f1CommissionId: f1Commission?.id || null,
          f0CommissionId: f0Commission?.id || null,
          notes: `Commission summary for ${orderDetail.product.name} (${quantity} items)`,
        },
      });

      this.logger.log(
        `Created commission summary for orderDetail ${orderDetail.id}: total=${totalAmount}, paid=${commissionPaid}, platform=${platformCut}, remaining=${remainingAmount}`,
      );
    }
  }

  private getCategoryGroupRate(group: CategoryGroup): number {
    switch (group) {
      case CategoryGroup.a:
        return 0.2; // 20%
      case CategoryGroup.b:
        return 0.3; // 30%
      case CategoryGroup.c:
        return 0.5; // 50%
      default:
        return 0.5; // Default to 50%
    }
  }
}
