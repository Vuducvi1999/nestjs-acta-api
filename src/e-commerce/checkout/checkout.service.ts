import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OriginSource } from '@prisma/client';
import { CartItemResponseDto } from '../../public/carts/dto/public-cart-response.dto';
import { JwtPayload } from '../../auth/jwt-payload';
import { PrismaService } from '../../common/services/prisma.service';
import { PublicCartService } from '../../public/carts/public-cart.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutHelper } from './checkout.helper';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import {
  OrderResponseDto,
  PublicOrderDetailResponseDto,
} from './dto/order-response.dto';
import {
  CartItemWithInventory,
  OrderTotals,
  PaymentInfo,
  PrismaTransaction,
  ProductInventory,
  ProductWithDetails,
} from './types/checkout.types';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicCartService: PublicCartService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Create order from cart - Step 1: Create Order & Reserve Inventory
   */
  async createOrderFromCart(
    user: JwtPayload,
    createOrderDto: CreateOrderFromCartDto,
  ): Promise<OrderResponseDto> {
    try {
      this.logger.log(`Creating order from cart for user ${user.id}`);

      // Validate terms agreement
      if (!createOrderDto.agreedToTerms) {
        throw new BadRequestException(
          'Bạn phải đồng ý với điều khoản và điều kiện',
        );
      }

      // Validate payment method and provider combination
      if (
        createOrderDto.paymentMethod === 'transfer' &&
        createOrderDto.paymentProvider !== 'vietqr'
      ) {
        throw new BadRequestException(
          'Phương thức chuyển khoản chỉ hỗ trợ VietQR',
        );
      }

      // Validate delivery type requirements
      if (createOrderDto.deliveryType === 1) {
        // ShipCOD
        if (!createOrderDto.shippingAddress) {
          throw new BadRequestException(
            'Địa chỉ vận chuyển là bắt buộc khi chọn giao hàng COD',
          );
        }
        if (!createOrderDto.shippingAddress.addressLine1?.trim()) {
          throw new BadRequestException('Địa chỉ chi tiết không được để trống');
        }
        if (!createOrderDto.shippingAddress.province?.trim()) {
          throw new BadRequestException('Tỉnh/Thành phố không được để trống');
        }
        if (!createOrderDto.shippingAddress.district?.trim()) {
          throw new BadRequestException('Quận/Huyện không được để trống');
        }
        if (!createOrderDto.shippingAddress.ward?.trim()) {
          throw new BadRequestException('Phường/Xã không được để trống');
        }
      } else if (createOrderDto.deliveryType === 2) {
        // PickupAtWarehouse
        if (!createOrderDto.pickupWarehouseId && !createOrderDto.warehouseId) {
          throw new BadRequestException(
            'ID kho nhận hàng là bắt buộc khi chọn nhận tại kho',
          );
        }
      }

      // Check idempotency - if clientRequestId is provided, check for existing order
      if (createOrderDto.clientRequestId) {
        const existingOrder = await this.prisma.order.findFirst({
          where: {
            clientRequestId: createOrderDto.clientRequestId,
            customer: {
              userId: user.id,
            },
          },
          include: {
            orderDetails: {
              include: {
                product: {
                  include: {
                    category: true,
                    business: true,
                    images: {
                      take: 1,
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
            payments: true,
            orderDelivery: true,
          },
        });

        if (existingOrder) {
          this.logger.log(
            `Returning existing order for idempotency key: ${createOrderDto.clientRequestId}`,
          );
          return OrderResponseDto.fromOrder(existingOrder);
        }
      }

      // Pre-validate cart before proceeding with checkout
      // Pass undefined warehouseId to let the cart service use optimal warehouse selection
      const cartValidation =
        await this.publicCartService.validateCartForCheckout(
          user.id,
          undefined, // Let cart service select optimal warehouse
        );

      if (!cartValidation.isValid) {
        // Auto-cleanup invalid items
        const cleanupResult =
          await this.publicCartService.cleanupInvalidCartItems(user.id);

        if (cleanupResult.removedCount > 0) {
          this.logger.log(
            `Auto-cleaned up ${cleanupResult.removedCount} invalid cart items for user ${user.id}`,
          );

          // Re-validate after cleanup
          const revalidation =
            await this.publicCartService.validateCartForCheckout(
              user.id,
              undefined, // Let cart service select optimal warehouse
            );

          if (!revalidation.isValid) {
            throw new BadRequestException(
              `Giỏ hàng vẫn chứa sản phẩm không hợp lệ sau khi dọn dẹp. Vui lòng kiểm tra lại: ${revalidation.errors.join(', ')}`,
            );
          }
        } else {
          // If cleanup didn't help, throw error with details
          throw new BadRequestException(
            `Giỏ hàng chứa sản phẩm không hợp lệ: ${cartValidation.errors.join(', ')}`,
          );
        }
      }

      // Get user's cart items
      const cartItems = await this.getUserCartItems(user.id);

      if (!cartItems || cartItems.length === 0) {
        throw new BadRequestException('Giỏ hàng trống');
      }

      // Create order with inventory reservation in a single transaction
      const order = await this.createOrderWithInventoryReservation(
        user,
        createOrderDto,
        cartItems,
      );

      this.logger.log(`Order created successfully: ${order.orderId}`);

      return order;
    } catch (error) {
      CheckoutHelper.handleError(error, 'tạo đơn hàng', this.logger);
      throw error; // Re-throw the error so the controller can handle it
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(
    user: JwtPayload,
    orderId: string,
  ): Promise<PublicOrderDetailResponseDto> {
    try {
      const order = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          customer: {
            userId: user.id,
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
              product: {
                include: {
                  category: true,
                  business: true,
                  images: {
                    take: 1,
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
          payments: true,
          orderDelivery: true,
          warehouse: true,
          saleChannel: true,
        },
      });

      if (!order) {
        throw new BadRequestException('Đơn hàng không tồn tại');
      }

      // Get payment info if available
      let paymentInfo: PaymentInfo | undefined = undefined;

      if (order.payments && order.payments.length > 0) {
        const payment = await this.prisma.payment.findFirst({
          where: {
            orderPayment: {
              orderId: order.id,
            },
          },
        });

        if (payment) {
          paymentInfo = {
            paymentId: payment.id,
            provider: payment.provider,
            status: payment.status,
            amount: Number(payment.amount),
          };
        }
      }

      return PublicOrderDetailResponseDto.fromOrder({
        ...order,
        paymentInfo,
      });
    } catch (error) {
      CheckoutHelper.handleError(error, 'lấy đơn hàng', this.logger);
      throw error; // Re-throw the error so the controller can handle it
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(
    user: JwtPayload,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    orders: PublicOrderDetailResponseDto[];
    totalItems: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;

      const [orders, totalItems] = await Promise.all([
        this.prisma.order.findMany({
          where: {
            customer: {
              userId: user.id,
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
                product: {
                  include: {
                    category: true,
                    business: true,
                    images: {
                      take: 1,
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
            payments: true,
            orderDelivery: true,
            warehouse: true,
            saleChannel: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.order.count({
          where: {
            customer: {
              userId: user.id,
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return {
        orders: orders.map((order) =>
          PublicOrderDetailResponseDto.fromOrder(order),
        ),
        totalItems,
        page,
        totalPages,
      };
    } catch (error) {
      CheckoutHelper.handleError(
        error,
        'lấy đơn hàng của người dùng',
        this.logger,
      );
      throw error; // Re-throw the error so the controller can handle it
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    user: JwtPayload,
    orderId: string,
    reason?: string,
  ): Promise<PublicOrderDetailResponseDto> {
    try {
      const order = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          customer: {
            userId: user.id,
          },
        },
      });

      if (!order) {
        throw new BadRequestException('Đơn hàng không tồn tại');
      }

      if (order.status !== 'draft' && order.status !== 'confirmed') {
        throw new BadRequestException(
          'Không thể hủy đơn hàng ở trạng thái này',
        );
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'cancelled',
          adminNote: reason
            ? `Hủy bởi khách hàng: ${reason}`
            : 'Hủy bởi khách hàng',
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
              product: {
                include: {
                  category: true,
                  business: true,
                  images: {
                    take: 1,
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
          payments: true,
          orderDelivery: true,
          warehouse: true,
          saleChannel: true,
        },
      });

      this.logger.log(`Order ${orderId} cancelled by user ${user.id}`);

      return PublicOrderDetailResponseDto.fromOrder(updatedOrder);
    } catch (error) {
      CheckoutHelper.handleError(error, 'hủy đơn hàng', this.logger);
      throw error; // Re-throw the error so the controller can handle it
    }
  }

  /**
   * Validate idempotency key
   */
  private async validateIdempotencyKey(
    idempotencyKey: string,
    userId: string,
  ): Promise<void> {
    // Check if this idempotency key was already used
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        customer: {
          userId,
        },
        // You might want to add an idempotencyKey field to the Order model
        // For now, we'll use a simple check based on recent orders
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    if (existingOrder) {
      throw new BadRequestException(
        'Đơn hàng đã được tạo gần đây. Vui lòng thử lại sau.',
      );
    }
  }

  /**
   * Get user's cart items
   */
  private async getUserCartItems(
    userId: string,
  ): Promise<CartItemResponseDto[]> {
    const cart = await this.publicCartService.getCart(userId);
    return cart?.items || [];
  }

  /**
   * Create order with inventory reservation in a single transaction
   */
  private async createOrderWithInventoryReservation(
    user: JwtPayload,
    createOrderDto: CreateOrderFromCartDto,
    cartItems: CartItemResponseDto[],
  ): Promise<OrderResponseDto> {
    return await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      // Get sale channel - use provided ID or get first available one
      let saleChannelId: string;
      if (createOrderDto.saleChannelId) {
        saleChannelId = createOrderDto.saleChannelId;
        console.log('Using provided saleChannelId:', saleChannelId);
      } else {
        // Get first available sale channel instead of looking for specific ones
        const availableSaleChannels = await tx.saleChannel.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        });

        if (availableSaleChannels.length === 0) {
          throw new BadRequestException(
            'No active sale channels found in database',
          );
        }

        saleChannelId = availableSaleChannels[0].id;
        console.log('Using first available saleChannelId:', saleChannelId);
      }

      console.log('Final saleChannelId for order creation:', saleChannelId);

      // Determine warehouse: use provided warehouseId, pickupWarehouseId, or select optimal warehouse
      let warehouseId: string;
      if (createOrderDto.warehouseId || createOrderDto.pickupWarehouseId) {
        warehouseId =
          createOrderDto.warehouseId || createOrderDto.pickupWarehouseId!;
      } else {
        // No warehouse specified - select optimal warehouse based on product inventories
        const productIds = cartItems.map((item) => item.product.id);
        const optimalWarehouse = await CheckoutHelper.selectOptimalWarehouse(
          tx,
          productIds,
        );
        warehouseId = optimalWarehouse.id;

        this.logger.log(
          `No warehouse specified, selected optimal warehouse: ${optimalWarehouse.name} (${optimalWarehouse.id})`,
        );
      }

      if (!warehouseId) {
        throw new BadRequestException('Không tìm thấy kho hàng mặc định');
      }

      // Load cart items with product and inventory information
      const itemsWithInventory = await this.loadCartItemsWithInventory(
        cartItems,
        warehouseId,
        tx,
      );

      // Validate product availability and sales status
      this.validateProductAvailability(itemsWithInventory);

      // Validate stock availability
      this.validateStockAvailability(itemsWithInventory);

      // Compute totals (server-side)
      const totals = this.computeOrderTotals(
        itemsWithInventory,
        createOrderDto,
      );

      // Generate order code
      const orderCode = await CheckoutHelper.generateOrderCode(warehouseId, tx);

      // Get bank account for transfer payment
      const bankAccount =
        createOrderDto.paymentMethod === 'transfer'
          ? await CheckoutHelper.getBankAccountForTransfer(
              createOrderDto.paymentProvider,
            )
          : null;

      // Get or create customer
      const customer = await CheckoutHelper.getOrCreateCustomer(user, tx);

      console.log('Creating order with data:', {
        code: orderCode,
        warehouseId,
        saleChannelId,
        customerId: customer.id,
        deliveryType: createOrderDto.deliveryType,
      });

      console.log('Order creation data object:', {
        code: orderCode,
        clientRequestId: createOrderDto.clientRequestId,
        purchaseDate: new Date(),
        status: 'draft',
        usingCod: createOrderDto.paymentMethod === 'cash',
        warehouseId,
        saleChannelId,
        customerId: customer.id,
        source: OriginSource.acta,
        subtotal: totals.subtotal,
        shippingFee: totals.shippingFee,
        discount: totals.discount,
        total: totals.total,
      });

      // Create order
      const order = await tx.order.create({
        data: {
          code: orderCode,
          clientRequestId: createOrderDto.clientRequestId,
          purchaseDate: new Date(),
          status: 'draft',
          usingCod: createOrderDto.paymentMethod === 'cash',
          warehouseId,
          saleChannelId,
          customerId: customer.id,
          source: OriginSource.acta,
          subtotal: totals.subtotal,
          shippingFee: totals.shippingFee,
          discount: totals.discount,
          total: totals.total,
          // Delivery snapshot
          orderDelivery: {
            create: {
              code: `DEL-${orderCode}`,
              type: createOrderDto.deliveryType,
              price: totals.shippingFee,
              receiver: createOrderDto.receiver.fullName,
              contactNumber: createOrderDto.receiver.phone,
              address: createOrderDto.shippingAddress
                ? `${createOrderDto.shippingAddress.addressLine1}, ${createOrderDto.shippingAddress.ward}, ${createOrderDto.shippingAddress.district}, ${createOrderDto.shippingAddress.province}`
                : '',
            },
          },
          // Order details
          orderDetails: {
            create: itemsWithInventory.map((item) => ({
              quantity: item.quantity,
              price: item.product.price, // Lưu giá tại thời điểm mua hàng
              discount: 0,
              soldById: item.product.businessId || 'cmemhlrjk0001zgb3qe2ii5d7',
              productId: item.product.id,
            })),
          },
          // Order payment
          payments: {
            create: {
              code: `PAY-${orderCode}`,
              method: createOrderDto.paymentMethod,
              status: 'processing',
              amount: totals.total,
              transDate: new Date(),
              bankAccount: bankAccount?.description || 'Cash',
              description: `ACTA ${orderCode}`,
              expiresAt: CheckoutHelper.expiresAtFromConfig(),
              accountId: bankAccount?.id,
            },
          },
        },
        include: {
          orderDetails: {
            include: {
              product: {
                include: {
                  category: true,
                  business: true,
                  images: {
                    take: 1,
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
          payments: true,
          orderDelivery: true,
        },
      });

      // Reserve inventory
      await this.reserveInventory(itemsWithInventory, tx);

      // Optionally clear cart after success
      // await this.publicCartService.clearCart(user.id);

      return OrderResponseDto.fromOrder(order);
    });
  }

  /**
   * Load cart items with product and inventory information
   */
  private async loadCartItemsWithInventory(
    cartItems: CartItemResponseDto[],
    warehouseId: string,
    tx: PrismaTransaction,
  ): Promise<CartItemWithInventory[]> {
    console.log(
      'Cart items received:',
      cartItems.map((item) => ({
        cartItemId: item.cartItemId,
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
      })),
    );

    const productIds = cartItems.map((item) => item.product.id);

    console.log('Querying products with IDs:', productIds);

    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        allowsSale: true,
      },
      select: {
        id: true,
        name: true,
        price: true,
        basePrice: true,
        minQuantity: true,
        maxQuantity: true,
        businessId: true,
        isActive: true,
        allowsSale: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        business: {
          select: {
            id: true,
            name: true,
          },
        },
        images: {
          select: {
            id: true,
            url: true,
            sortOrder: true,
            isMain: true,
          },
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    console.log(
      'Found products:',
      products.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
        allowsSale: p.allowsSale,
      })),
    );

    console.log('Loading inventory for warehouse:', warehouseId);
    console.log('Product IDs from cart:', productIds);

    const inventories = await tx.productInventory.findMany({
      where: {
        productId: { in: productIds },
        warehouseId,
      },
    });

    console.log('Found inventories:', inventories);

    return cartItems.map((cartItem) => {
      const product = products.find((p) => p.id === cartItem.product.id);
      const inventory = inventories.find(
        (i) =>
          i.productId === cartItem.product.id && i.warehouseId === warehouseId,
      );

      console.log('Cart item product:', {
        cartItemProductId: cartItem.product.id,
        cartItemProductName: cartItem.product.name,
        foundProduct: product?.id,
        foundInventory: inventory?.id,
        warehouseId,
      });

      // If product is not found, it means it's not active or doesn't allow sales
      if (!product) {
        throw new BadRequestException(
          `Sản phẩm ${cartItem.product.name} không hợp lệ hoặc không tồn tại`,
        );
      }

      return {
        cartItemId: cartItem.cartItemId,
        quantity: cartItem.quantity,
        subtotal: cartItem.subtotal,
        product: product as ProductWithDetails,
        inventory: inventory as ProductInventory,
        unitPrice: Number(product?.price) || 0,
        lineTotal: Number(product?.price || 0) * cartItem.quantity,
        createdAt: cartItem.createdAt,
        updatedAt: cartItem.updatedAt,
      };
    });
  }

  /**
   * Validate product availability and sales status
   */
  private validateProductAvailability(
    itemsWithInventory: CartItemWithInventory[],
  ): void {
    for (const item of itemsWithInventory) {
      // Check if product exists
      if (!item.product) {
        throw new BadRequestException(
          'Sản phẩm không hợp lệ hoặc không tồn tại',
        );
      }

      // Check if product is active
      if (!item.product.isActive) {
        throw new BadRequestException(
          `Sản phẩm ${item.product.name} không còn hoạt động`,
        );
      }

      // Check if product allows sales
      if (!item.product.allowsSale) {
        throw new BadRequestException(
          `Sản phẩm ${item.product.name} không cho phép bán hàng`,
        );
      }

      // Check if product has valid business
      if (!item.product.businessId) {
        throw new BadRequestException(
          `Sản phẩm ${item.product.name} không có thông tin doanh nghiệp hợp lệ`,
        );
      }
    }
  }

  /**
   * Validate stock availability
   */
  private validateStockAvailability(
    itemsWithInventory: CartItemWithInventory[],
  ): void {
    for (const item of itemsWithInventory) {
      if (!item.inventory) {
        throw new BadRequestException(
          `Không tìm thấy tồn kho cho sản phẩm ${item.product?.name || item.product.id}`,
        );
      }

      const availableStock = item.inventory.onHand - item.inventory.reserved;
      if (availableStock < item.quantity) {
        throw new BadRequestException(
          `Sản phẩm ${item.product?.name || item.product.id} chỉ còn ${availableStock} sản phẩm trong kho`,
        );
      }
    }
  }

  /**
   * Compute order totals
   */
  private computeOrderTotals(
    itemsWithInventory: CartItemWithInventory[],
    createOrderDto: CreateOrderFromCartDto,
  ): OrderTotals {
    const subtotal = itemsWithInventory.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    const shippingFee = createOrderDto.deliveryType === 1 ? 30000 : 0; // Fixed shipping fee for ShipCOD
    const discount = 0; // TODO: Apply voucher codes
    const total = subtotal + shippingFee - discount;

    return { subtotal, shippingFee, discount, total };
  }

  /**
   * Reserve inventory
   */
  private async reserveInventory(
    itemsWithInventory: CartItemWithInventory[],
    tx: PrismaTransaction,
  ): Promise<void> {
    for (const item of itemsWithInventory) {
      await tx.productInventory.update({
        where: { id: item.inventory.id },
        data: {
          reserved: {
            increment: item.quantity,
          },
          actualReserved: {
            increment: item.quantity,
          },
        },
      });
    }
  }
}
