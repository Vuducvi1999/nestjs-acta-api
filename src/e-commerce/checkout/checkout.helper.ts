import { BadRequestException, Logger } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentProcessingStatus,
  OriginSource,
  Role,
} from '@prisma/client';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import { PublicOrderDetailResponseDto } from './dto/order-response.dto';
import { PublicCartHelper } from '../../public/carts/public-cart.helper';
import {
  CartItem,
  ProductWithInventory,
  OrderDetailWithOrder,
  InventoryRecord,
  PrismaTransaction,
  Warehouse,
  ProductForInventory,
} from './types/inventory.types';

export class CheckoutHelper {
  private static readonly logger = new Logger(CheckoutHelper.name);
  private static readonly prisma = new PrismaClient();

  // Default avatar URL for missing images
  private static readonly DEFAULT_AVATAR_URL =
    'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b';

  /**
   * Generate unique order code based on region + date + sequential number
   * Format: [Region Code] - [Order Date] - [Sequential Number]
   * Example: HN-250827-023 (Hà Nội), HCM-250827-145 (Hồ Chí Minh)
   */
  static async generateOrderCode(
    warehouseId?: string,
    tx?: any,
  ): Promise<string> {
    try {
      // Get warehouse info to determine region code
      let regionCode = 'ORD'; // Default region code

      if (warehouseId) {
        try {
          const warehouse = await this.prisma.warehouse.findUnique({
            where: { id: warehouseId },
            include: {
              address: true,
            },
          });

          if (warehouse?.address) {
            // Determine region code based on address
            const city = warehouse.address.city?.toLowerCase();
            const state = warehouse.address.state?.toLowerCase();

            if (
              city?.includes('hà nội') ||
              city?.includes('hanoi') ||
              state?.includes('hà nội')
            ) {
              regionCode = 'HN';
            } else if (
              city?.includes('hồ chí minh') ||
              city?.includes('ho chi minh') ||
              city?.includes('tp.hcm') ||
              state?.includes('hồ chí minh')
            ) {
              regionCode = 'HCM';
            } else if (city?.includes('đà nẵng') || city?.includes('da nang')) {
              regionCode = 'DN';
            } else if (
              city?.includes('hải phòng') ||
              city?.includes('hai phong')
            ) {
              regionCode = 'HP';
            } else if (city?.includes('cần thơ') || city?.includes('can tho')) {
              regionCode = 'CT';
            } else if (city?.includes('huế') || city?.includes('hue')) {
              regionCode = 'HU';
            } else if (city?.includes('nha trang')) {
              regionCode = 'NT';
            } else if (
              city?.includes('vũng tàu') ||
              city?.includes('vung tau')
            ) {
              regionCode = 'VT';
            } else if (
              city?.includes('biên hòa') ||
              city?.includes('bien hoa')
            ) {
              regionCode = 'BH';
            } else if (city?.includes('thủ đức') || city?.includes('thu duc')) {
              regionCode = 'TD';
            }
          }
        } catch (error) {
          this.logger.warn(
            `Failed to get warehouse info for order code generation: ${error.message}`,
          );
        }
      }

      // Get current date in YYMMDD format
      const now = new Date();
      const orderDate =
        now.getFullYear().toString().slice(-2) +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0');

      // Get sequential number for today
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Use transaction if available, otherwise use default prisma client
      const prismaClient = tx || this.prisma;

      // Count orders for this specific region and date to avoid conflicts between regions
      const orderCount = await prismaClient.order.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
          code: {
            startsWith: `${regionCode}${orderDate}`, // Filter by region and date prefix
          },
        },
      });

      // Sequential number starts from 0001
      const sequentialNumber = (orderCount + 1).toString().padStart(4, '0');

      return `${regionCode}${orderDate}${sequentialNumber}`;
    } catch (error) {
      this.logger.error(`Failed to generate order code: ${error.message}`);
      // Fallback to simple order code if region-based generation fails
      return this.generateSimpleOrderCode();
    }
  }

  /**
   * Generate unique customer code
   */
  static generateCustomerCode(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `CUS-${timestamp}-${random}`;
  }

  /**
   * Generate simple order code (fallback method)
   * Used when warehouse information is not available
   */
  static generateSimpleOrderCode(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Get or create customer for user
   */
  static async getOrCreateCustomer(user: any, tx: any): Promise<any> {
    // Check if customer already exists for this user
    let customer = await tx.customer.findUnique({
      where: { userId: user.id },
      include: {
        customerGroup: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            avatar: {
              select: {
                fileUrl: true,
              },
            },
          },
        },
      },
    });

    if (customer) {
      return customer;
    }

    // Create customer group based on user role if not exists
    const customerGroupName = this.getCustomerGroupNameByRole(user.role);
    let customerGroup = await tx.customerGroup.findFirst({
      where: { name: customerGroupName },
    });

    if (!customerGroup) {
      customerGroup = await tx.customerGroup.create({
        data: {
          name: customerGroupName,
        },
      });
    }

    // Create new customer
    customer = await tx.customer.create({
      data: {
        kiotVietCustomerCode: this.generateCustomerCode(),
        userId: user.id,
        customerGroupId: customerGroup.id,
        source: OriginSource.acta,
        rewardPoint: 0,
      },
      include: {
        customerGroup: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            avatar: {
              select: {
                fileUrl: true,
              },
            },
          },
        },
      },
    });

    return customer;
  }

  /**
   * Get customer group name based on user role
   */
  private static getCustomerGroupNameByRole(role: Role): string {
    switch (role) {
      case Role.admin:
        return 'Ban Điều hành';
      case Role.collaborator:
        return 'Cộng tác viên';
      case Role.moderator:
        return 'Ban Quản lý';
      case Role.user:
      default:
        return 'Khách hàng';
    }
  }

  /**
   * Get default sale channel
   */
  static async getDefaultSaleChannel(tx: any): Promise<any> {
    const defaultSaleChannel = await tx.saleChannel.findFirst({
      where: {
        source: OriginSource.acta,
        isActive: true,
      },
    });

    if (!defaultSaleChannel) {
      throw new BadRequestException(
        'Default sale channel not found. Please run the seed script first.',
      );
    }

    return defaultSaleChannel;
  }

  /**
   * Get default warehouse
   */
  static async getDefaultWarehouse(tx: any): Promise<any> {
    const defaultWarehouse = await tx.warehouse.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!defaultWarehouse) {
      throw new BadRequestException(
        'No active warehouse found. Please create a warehouse first.',
      );
    }

    return defaultWarehouse;
  }

  /**
   * Select optimal warehouse based on product inventories
   * This method analyzes all warehouses to find the best one for the order
   */
  static async selectOptimalWarehouse(
    tx: any,
    productIds: string[],
  ): Promise<any> {
    if (!productIds || productIds.length === 0) {
      // Fallback to default warehouse if no products
      return this.getDefaultWarehouse(tx);
    }

    // Get all active warehouses with their product inventories
    const warehousesWithInventories = await tx.warehouse.findMany({
      where: {
        isActive: true,
      },
      include: {
        productInventories: {
          where: {
            productId: { in: productIds },
            onHand: { gt: 0 }, // Only consider warehouses with stock
          },
          select: {
            productId: true,
            onHand: true,
            reserved: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (warehousesWithInventories.length === 0) {
      throw new BadRequestException('Không tìm thấy kho hàng hoạt động nào');
    }

    // Score each warehouse based on inventory availability
    const warehouseScores = warehousesWithInventories.map((warehouse) => {
      const inventoryCount = warehouse.productInventories.length;
      const totalAvailableStock = warehouse.productInventories.reduce(
        (sum, inv) => sum + (inv.onHand - (inv.reserved || 0)),
        0,
      );

      // Calculate coverage percentage (how many products are available in this warehouse)
      const coveragePercentage = (inventoryCount / productIds.length) * 100;

      // Only consider warehouses that have inventory for ALL products in the cart
      if (inventoryCount < productIds.length) {
        return {
          warehouse,
          score: 0, // Disqualify warehouses that don't have all products
          coveragePercentage,
          totalAvailableStock,
          inventoryCount,
          disqualified: true,
        };
      }

      // Score based on coverage and total available stock
      const score =
        coveragePercentage * 0.7 + (totalAvailableStock > 0 ? 30 : 0);

      return {
        warehouse,
        score,
        coveragePercentage,
        totalAvailableStock,
        inventoryCount,
        disqualified: false,
      };
    });

    // Sort by score (highest first) and select the best warehouse
    warehouseScores.sort((a, b) => b.score - a.score);

    // Filter out disqualified warehouses
    const qualifiedWarehouses = warehouseScores.filter(
      (w) => !w.disqualified && w.score > 0,
    );

    if (qualifiedWarehouses.length === 0) {
      this.logger.warn(
        `No warehouse has inventory for all ${productIds.length} products. Falling back to default warehouse.`,
      );
      return this.getDefaultWarehouse(tx);
    }

    const selectedWarehouse = qualifiedWarehouses[0];

    this.logger.log(
      `Selected warehouse "${selectedWarehouse.warehouse.name}" with score ${selectedWarehouse.score.toFixed(2)}, coverage: ${selectedWarehouse.coveragePercentage.toFixed(1)}%, available stock: ${selectedWarehouse.totalAvailableStock}`,
    );

    return selectedWarehouse.warehouse;
  }

  /**
   * Create order delivery information
   */
  static async createOrderDelivery(
    orderId: string,
    createOrderDto: CreateOrderFromCartDto,
    tx: any,
  ): Promise<any> {
    // Get receiver info from guest contact or use default
    const receiverName = createOrderDto.guestContact?.fullName || 'Khách hàng';
    const receiverPhone = createOrderDto.guestContact?.phone || 'N/A';

    // Validate shipping address
    if (!createOrderDto.shippingAddress) {
      throw new BadRequestException('Địa chỉ giao hàng không được để trống');
    }

    // Debug: Log shipping address
    this.logger.debug('Shipping address:', createOrderDto.shippingAddress);

    const deliveryData = {
      code: `DEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: createOrderDto.deliveryType,
      receiver: receiverName,
      contactNumber: receiverPhone,
      address: this.formatAddress(createOrderDto.shippingAddress),
      source: OriginSource.acta,
      orderId,
    };

    // Add optional fields
    if (createOrderDto.scheduledAt) {
      deliveryData['scheduledAt'] = new Date(createOrderDto.scheduledAt);
    }

    return await tx.orderDelivery.create({
      data: deliveryData,
    });
  }

  /**
   * Format address for delivery
   */
  private static formatAddress(address: any): string {
    if (!address) {
      return 'Địa chỉ không xác định';
    }

    const parts = [
      address.line1,
      address.line2,
      address.ward,
      address.district,
      address.province,
      address.country || 'VN',
    ].filter((part): part is string => Boolean(part));

    return parts.join(', ');
  }

  /**
   * Create order payment record
   */
  static async createOrderPayment(
    orderId: string,
    createOrderDto: CreateOrderFromCartDto,
    totalAmount: number,
    tx: any,
  ): Promise<any> {
    // Create the order payment record
    const orderPaymentData = {
      code: `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      method: createOrderDto.paymentMethod,
      status: PaymentStatus.processing,
      amount: new Prisma.Decimal(totalAmount),
      transDate: new Date(),
      bankAccount: this.getBankAccountByMethod(createOrderDto.paymentMethod),
      description: `Thanh toán đơn hàng qua ${createOrderDto.paymentProvider || 'cash'}`,
      source: OriginSource.acta,
      orderId,
    };

    const orderPayment = await tx.orderPayment.create({
      data: orderPaymentData,
    });

    // If it's an electronic payment (not cash), create a Payment record
    if (
      createOrderDto.paymentMethod !== PaymentMethod.cash &&
      createOrderDto.paymentProvider
    ) {
      const paymentData = {
        code: `GATEWAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        provider: createOrderDto.paymentProvider,
        providerRef: `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        amount: new Prisma.Decimal(totalAmount),
        currency: 'VND',
        status: PaymentProcessingStatus.created,
        idempotencyKey: createOrderDto.idempotencyKey,
        orderPaymentId: orderPayment.id,
        requestMeta: {
          method: createOrderDto.paymentMethod,
          provider: createOrderDto.paymentProvider,
          createdAt: new Date().toISOString(),
        },
      };

      await tx.payment.create({
        data: paymentData,
      });
    }

    return orderPayment;
  }

  /**
   * Get bank account by payment method
   */
  private static getBankAccountByMethod(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.cash:
        return 'Thanh toán tiền mặt';
      case PaymentMethod.card:
        return 'Thẻ ngân hàng';
      case PaymentMethod.wallet:
        return 'Ví điện tử';
      case PaymentMethod.transfer:
        return 'Chuyển khoản ngân hàng';
      case PaymentMethod.voucher:
        return 'Voucher';
      case PaymentMethod.other:
      default:
        return 'Phương thức khác';
    }
  }

  /**
   * Create order details from cart items
   */
  static async createOrderDetails(
    orderId: string,
    cartItems: any[],
    tx: any,
  ): Promise<any[]> {
    const orderDetails: any[] = [];

    for (const cartItem of cartItems) {
      const product = cartItem.product;

      // Note: Product availability and stock validation is handled in validateCartItems
      // in the checkout service before this method is called

      const orderDetail = await tx.orderDetail.create({
        data: {
          quantity: cartItem.quantity,
          price: product.price, // Lưu giá tại thời điểm mua hàng
          discount: new Prisma.Decimal(0),
          discountRatio: 0,
          isMaster: false,
          note: null,
          source: OriginSource.acta,
          soldById: product.businessId || (await this.getDefaultBusinessId(tx)),
          orderId,
          productId: product.id,
        },
      });

      orderDetails.push(orderDetail);
    }

    return orderDetails;
  }

  /**
   * Get default business ID
   */
  private static async getDefaultBusinessId(tx: any): Promise<string> {
    const defaultBusiness = await tx.business.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!defaultBusiness) {
      throw new BadRequestException('No active business found');
    }

    return defaultBusiness.id;
  }

  /**
   * Calculate order totals
   */
  static calculateOrderTotals(cartItems: any[]): {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  } {
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    const discount = 0; // TODO: Implement discount calculation
    const shipping = 0; // TODO: Implement shipping calculation
    const tax = 0; // TODO: Implement tax calculation

    const total = subtotal - discount + shipping + tax;

    return {
      subtotal,
      discount,
      shipping,
      tax,
      total,
    };
  }

  /**
   * Create order from cart
   */
  static async createOrderFromCart(
    user: any,
    createOrderDto: CreateOrderFromCartDto,
    cartItems: any[],
  ): Promise<PublicOrderDetailResponseDto> {
    return await this.prisma.$transaction(async (tx) => {
      // Get or create customer
      const customer = await this.getOrCreateCustomer(user, tx);

      // Get default sale channel and warehouse
      const saleChannel = await this.getDefaultSaleChannel(tx);
      const warehouse = await this.getDefaultWarehouse(tx);

      // Validate and reserve inventory
      await this.validateAndReserveInventory(cartItems, tx);

      // Calculate totals
      const totals = this.calculateOrderTotals(cartItems);

      // Create order
      const order = await tx.order.create({
        data: {
          code: await this.generateOrderCode(warehouse.id, tx),
          purchaseDate: new Date(),
          description: createOrderDto.note,
          status: OrderStatus.draft,
          paymentStatus: PaymentStatus.processing,
          usingCod: createOrderDto.paymentMethod === PaymentMethod.cash,
          subtotal: new Prisma.Decimal(totals.subtotal),
          shippingFee: new Prisma.Decimal(totals.shipping),
          discount: new Prisma.Decimal(totals.discount),
          total: new Prisma.Decimal(totals.total),
          customerNote: createOrderDto.note,
          warehouseId: warehouse.id,
          discountRatio:
            totals.discount > 0 ? (totals.discount / totals.subtotal) * 100 : 0,
          customerId: customer.id,
          saleChannelId: saleChannel.id,
          source: OriginSource.acta,
        },
        include: {
          customer: {
            include: {
              user: true,
              customerGroup: true,
            },
          },
          warehouse: true,
          saleChannel: true,
        },
      });

      // Create order delivery
      const orderDelivery = await this.createOrderDelivery(
        order.id,
        createOrderDto,
        tx,
      );

      // Create order details
      const orderDetails = await this.createOrderDetails(
        order.id,
        cartItems,
        tx,
      );

      // Create order payment
      const orderPayment = await this.createOrderPayment(
        order.id,
        createOrderDto,
        totals.total,
        tx,
      );

      // Update order with delivery ID
      await tx.order.update({
        where: { id: order.id },
        data: { orderDeliveryId: orderDelivery.id },
      });

      // Update inventory on order creation
      await this.updateInventoryOnOrderCreation(orderDetails, tx);

      // Note: Cart clearing is now handled by the frontend after successful payment
      // to prevent data loss if order creation fails
      // await tx.cartItem.deleteMany({
      //   where: {
      //     cartId: cartItems[0]?.cartId,
      //   },
      // });

      // Return formatted order response
      return this.formatOrderResponse(
        order,
        orderDetails,
        orderPayment,
        orderDelivery,
        totals,
      );
    });
  }

  /**
   * Format order response
   */
  private static formatOrderResponse(
    order: any,
    orderDetails: any[],
    orderPayment: any,
    orderDelivery: any,
    totals: any,
  ): PublicOrderDetailResponseDto {
    return PublicOrderDetailResponseDto.fromOrder({
      ...order,
      items: orderDetails.map((detail) => ({
        ...detail,
        product: detail.product || {},
      })),
      payments: [orderPayment],
      delivery: orderDelivery,
      subtotal: totals.subtotal,
      discountTotal: totals.discount,
      shippingFee: totals.shipping,
      taxTotal: totals.tax,
      grandTotal: totals.total,
      currency: 'VND',
    });
  }

  /**
   * Handle errors consistently
   */
  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in checkout - ${operation}: ${error.message}`,
      error.stack,
    );

    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(`Không thể ${operation}`);
  }

  /**
   * Validate cart items availability and reserve inventory
   */
  static async validateAndReserveInventory(
    cartItems: CartItem[],
    tx: PrismaTransaction,
  ): Promise<void> {
    if (cartItems.length === 0) return;

    // Debug: Log cart items structure
    this.logger.debug(
      `Validating and reserving inventory for ${cartItems.length} cart items`,
    );
    cartItems.forEach((item, index) => {
      this.logger.debug(`Cart item ${index}:`, {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        hasProduct: !!item.product,
        productKeys: item.product ? Object.keys(item.product) : [],
        productIdFromProduct: item.product?.id,
      });
    });

    // Get all product IDs from cart items and filter out undefined values
    const productIds = cartItems
      .map((item) => {
        // Handle different possible structures
        if (item.productId) return item.productId;
        if (item.product?.id) return item.product.id;
        // If we have a product object but no id, log it for debugging
        if (item.product) {
          this.logger.warn(`Cart item has product object but no id:`, item);
        }
        return null;
      })
      .filter((id) => id !== undefined && id !== null);

    // Log the extracted product IDs for debugging
    this.logger.debug(`Extracted product IDs:`, productIds);

    // If no valid product IDs, throw error
    if (productIds.length === 0) {
      throw new BadRequestException('Không có sản phẩm hợp lệ trong giỏ hàng');
    }

    // Get default warehouse
    const defaultWarehouse = await this.getDefaultWarehouse(tx);

    // Batch query to get all products with their inventory
    const products = (await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        allowsSale: true,
      },
      include: {
        inventories: {
          where: {
            warehouseId: defaultWarehouse.id,
          },
        },
      },
    })) as ProductWithInventory[];

    // Create a map for quick lookup
    const productMap = new Map<string, ProductWithInventory>(
      products.map((p) => [p.id, p]),
    );

    // Validate each cart item and reserve inventory
    for (const item of cartItems) {
      // Get productId from different possible structures
      const productId = item.productId || item.product?.id;

      // Skip items without productId (these were filtered out earlier)
      if (!productId) {
        throw new BadRequestException(
          `Một số sản phẩm trong giỏ hàng không hợp lệ`,
        );
      }

      const product = productMap.get(productId);

      if (!product) {
        throw new BadRequestException(
          `Sản phẩm không tồn tại hoặc không khả dụng`,
        );
      }

      // Check if inventory exists for this product in the warehouse
      let inventory = product.inventories?.[0];

      if (!inventory) {
        // Create inventory record if it doesn't exist
        inventory = await tx.productInventory.create({
          data: {
            productId: product.id,
            warehouseId: defaultWarehouse.id,
            cost: product.basePrice,
            onHand: 0,
            onOrder: 0,
            reserved: 0,
            actualReserved: 0,
            minQuantity: product.minQuantity,
            maxQuantity: product.maxQuantity,
            source: OriginSource.acta,
          },
        });
      }

      // Check if we have enough available stock
      const availableStock = inventory.onHand - inventory.reserved;

      if (availableStock < item.quantity) {
        throw new BadRequestException(
          `Sản phẩm ${product.name} chỉ còn ${availableStock} trong kho (đã trừ đi số lượng đã đặt chỗ)`,
        );
      }

      // Reserve the inventory for this order
      await tx.productInventory.update({
        where: { id: inventory.id },
        data: {
          reserved: {
            increment: item.quantity,
          },
          actualReserved: {
            increment: item.quantity,
          },
        },
      });

      this.logger.debug(
        `Reserved ${item.quantity} units of product ${product.name} (ID: ${product.id})`,
      );
    }
  }

  /**
   * Update inventory when order is created and payment is initiated
   */
  static async updateInventoryOnOrderCreation(
    orderDetails: OrderDetailWithOrder[],
    tx: PrismaTransaction,
  ): Promise<void> {
    if (orderDetails.length === 0) return;

    this.logger.debug(
      `Updating inventory for ${orderDetails.length} order details`,
    );

    for (const orderDetail of orderDetails) {
      // Get the inventory for this product
      const inventory = await tx.productInventory.findFirst({
        where: {
          productId: orderDetail.productId,
          warehouse: {
            id: orderDetail.order.warehouseId,
          },
        },
      });

      if (!inventory) {
        this.logger.warn(
          `No inventory found for product ${orderDetail.productId} in warehouse ${orderDetail.order.warehouseId}`,
        );
        continue;
      }

      // When order is created and payment is initiated:
      // - reserved stays the same (already reserved during checkout)
      // - actualReserved stays the same (already reserved during checkout)
      // - onHand stays the same (will be decremented when payment succeeds)
      // - onOrder stays the same (this is for supplier orders, not customer orders)

      this.logger.debug(
        `Inventory updated for order detail ${orderDetail.id}: product ${orderDetail.productId}, quantity ${orderDetail.quantity}`,
      );
    }
  }

  /**
   * Update inventory when payment succeeds
   */
  static async updateInventoryOnPaymentSuccess(
    orderId: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    const orderDetails = await tx.orderDetail.findMany({
      where: { orderId },
      include: {
        product: true,
        order: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (orderDetails.length === 0) return;

    this.logger.debug(
      `Updating inventory on payment success for order ${orderId} with ${orderDetails.length} items`,
    );

    for (const orderDetail of orderDetails) {
      // Get the inventory for this product
      const inventory = await tx.productInventory.findFirst({
        where: {
          productId: orderDetail.productId,
          warehouseId: orderDetail.order.warehouseId,
        },
      });

      if (!inventory) {
        this.logger.warn(
          `No inventory found for product ${orderDetail.productId} in warehouse ${orderDetail.order.warehouseId}`,
        );
        continue;
      }

      // When payment succeeds:
      // - Decrement onHand (actual stock is reduced)
      // - Decrement reserved (no longer reserved, now sold)
      // - Decrement actualReserved (no longer reserved, now sold)
      // - onOrder stays the same (this is for supplier orders)

      await tx.productInventory.update({
        where: { id: inventory.id },
        data: {
          onHand: {
            decrement: orderDetail.quantity,
          },
          reserved: {
            decrement: orderDetail.quantity,
          },
          actualReserved: {
            decrement: orderDetail.quantity,
          },
        },
      });

      this.logger.debug(
        `Payment success: Reduced inventory for product ${orderDetail.productId} by ${orderDetail.quantity} units`,
      );
    }
  }

  /**
   * Restore inventory when payment fails or order is cancelled
   */
  static async restoreInventoryOnPaymentFailure(
    orderId: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    const orderDetails = await tx.orderDetail.findMany({
      where: { orderId },
      include: {
        product: true,
        order: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (orderDetails.length === 0) return;

    this.logger.debug(
      `Restoring inventory on payment failure for order ${orderId} with ${orderDetails.length} items`,
    );

    for (const orderDetail of orderDetails) {
      // Get the inventory for this product
      const inventory = await tx.productInventory.findFirst({
        where: {
          productId: orderDetail.productId,
          warehouseId: orderDetail.order.warehouseId,
        },
      });

      if (!inventory) {
        this.logger.warn(
          `No inventory found for product ${orderDetail.productId} in warehouse ${orderDetail.order.warehouseId}`,
        );
        continue;
      }

      // When payment fails or order is cancelled:
      // - onHand stays the same (stock wasn't actually sold)
      // - Decrement reserved (no longer reserved)
      // - Decrement actualReserved (no longer reserved)
      // - onOrder stays the same

      await tx.productInventory.update({
        where: { id: inventory.id },
        data: {
          reserved: {
            decrement: orderDetail.quantity,
          },
          actualReserved: {
            decrement: orderDetail.quantity,
          },
        },
      });

      this.logger.debug(
        `Payment failure: Restored reservation for product ${orderDetail.productId} by ${orderDetail.quantity} units`,
      );
    }
  }

  /**
   * Get payment expiry time from configuration
   */
  static expiresAtFromConfig(): Date {
    const PAYMENT_EXPIRES_MINUTES = process.env.PAYMENT_EXPIRES_MINUTES
      ? parseInt(process.env.PAYMENT_EXPIRES_MINUTES)
      : 30; // Default 30 minutes

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PAYMENT_EXPIRES_MINUTES);

    return expiresAt;
  }

  /**
   * Get bank account for transfer payment
   */
  static async getBankAccountForTransfer(provider: string = 'vietqr'): Promise<{
    id: string;
    bankName: string;
    accountNumber: string;
    description: string;
  } | null> {
    try {
      const bankAccount = await this.prisma.bankAccount.findFirst({
        where: {
          source: OriginSource.acta,
        },
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          description: true,
        },
      });
      return bankAccount;
    } catch (error) {
      this.logger.warn(
        'Failed to get bank account for transfer:',
        error.message,
      );
      return null;
    }
  }

  /**
   * Commit inventory on payment success (mirror of restoreInventoryOnPaymentFailure)
   */
  static async commitInventoryOnPaymentSuccess(
    orderId: string,
    tx: PrismaTransaction,
  ): Promise<void> {
    const orderDetails = await tx.orderDetail.findMany({
      where: { orderId },
      include: {
        product: true,
        order: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (orderDetails.length === 0) return;

    this.logger.debug(
      `Committing inventory on payment success for order ${orderId} with ${orderDetails.length} items`,
    );

    for (const orderDetail of orderDetails) {
      // Get the inventory for this product
      const inventory = await tx.productInventory.findFirst({
        where: {
          productId: orderDetail.productId,
          warehouseId: orderDetail.order.warehouseId,
        },
      });

      if (!inventory) {
        this.logger.warn(
          `No inventory found for product ${orderDetail.productId} in warehouse ${orderDetail.order.warehouseId}`,
        );
        continue;
      }

      // When payment succeeds:
      // - Decrement onHand (actual stock is reduced)
      // - Decrement reserved (no longer reserved, now sold)
      // - Decrement actualReserved (no longer reserved, now sold)
      // - onOrder stays the same (this is for supplier orders)

      await tx.productInventory.update({
        where: { id: inventory.id },
        data: {
          onHand: {
            decrement: orderDetail.quantity,
          },
          reserved: {
            decrement: orderDetail.quantity,
          },
          actualReserved: {
            decrement: orderDetail.quantity,
          },
        },
      });

      this.logger.debug(
        `Payment success: Reduced inventory for product ${orderDetail.productId} by ${orderDetail.quantity} units`,
      );
    }
  }
}
