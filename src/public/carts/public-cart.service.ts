import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../common/services/prisma.service';
import {
  AddToCartDto,
  RemoveFromCartDto,
  UpdateCartItemDto,
} from './dto/add-to-cart.dto';
import { CartItemQueryDto } from './dto/public-cart-query.dto';
import {
  CartResponseDto,
  PaginatedCartResponseDto,
} from './dto/public-cart-response.dto';
import { PublicCartHelper } from './public-cart.helper';

export const PUBLIC_CART_CONSTANTS = {
  CACHE_TTL: 10 * 1000, // 10 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
} as const;

@Injectable()
export class PublicCartService {
  private readonly logger = new Logger(PublicCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Add item to cart
   * Follows the same pattern as public product service methods
   */
  async addToCart(
    userId: string,
    addToCartDto: AddToCartDto,
  ): Promise<CartResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Validate product exists and is available
        const product = await tx.product.findFirst({
          where: {
            id: addToCartDto.productId,
            isActive: true,
            allowsSale: true,
          },
          include: {
            inventories: {
              where: {
                onHand: { gt: 0 }, // Only consider warehouses with actual stock
              },
            },
          },
        });

        PublicCartHelper.validateProductForCart(product);

        // Check if product has any inventory in active warehouses
        if (!product?.inventories || product.inventories.length === 0) {
          throw new Error(
            `Sản phẩm "${product?.name || 'Unknown'}" không có tồn kho trong bất kỳ kho hàng nào`,
          );
        }

        PublicCartHelper.checkStockAvailability(product, addToCartDto.quantity);

        // Get or create cart for user
        let cart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              include: PublicCartHelper.getCartItemIncludeClause(),
            },
          },
        });

        if (!cart) {
          cart = await tx.cart.create({
            data: {
              userId,
            },
            include: {
              items: {
                include: PublicCartHelper.getCartItemIncludeClause(),
              },
            },
          });
        }

        // Check if product already exists in cart
        const existingCartItem = cart.items.find(
          (item) => item.productId === addToCartDto.productId,
        );

        let updatedCart;
        if (existingCartItem) {
          // Update existing cart item quantity
          const newQuantity = existingCartItem.quantity + addToCartDto.quantity;

          // Check stock availability for new total quantity
          PublicCartHelper.checkStockAvailability(product, newQuantity);

          updatedCart = await tx.cart.update({
            where: { id: cart.id },
            data: {
              items: {
                update: {
                  where: { id: existingCartItem.id },
                  data: { quantity: newQuantity },
                },
              },
            },
            include: {
              items: {
                include: PublicCartHelper.getCartItemIncludeClause(),
              },
            },
          });
        } else {
          // Add new cart item
          updatedCart = await tx.cart.update({
            where: { id: cart.id },
            data: {
              items: {
                create: {
                  productId: addToCartDto.productId,
                  quantity: addToCartDto.quantity,
                },
              },
            },
            include: {
              items: {
                include: PublicCartHelper.getCartItemIncludeClause(),
              },
            },
          });
        }

        return CartResponseDto.fromCart(updatedCart);
      });
    } catch (error) {
      PublicCartHelper.handleError(error, 'addToCart method', this.logger);
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    userId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verify cart item belongs to user
        const cartItem = await tx.cartItem.findFirst({
          where: {
            id: updateCartItemDto.cartItemId,
            cart: { userId },
          },
          include: {
            product: {
              include: {
                inventories: {
                  where: {
                    onHand: { gt: 0 }, // Only consider warehouses with actual stock
                  },
                },
              },
            },
          },
        });

        if (!cartItem) {
          throw new Error('Cart item not found');
        }

        // Check stock availability
        PublicCartHelper.checkStockAvailability(
          (cartItem as any).product,
          updateCartItemDto.quantity,
        );

        // Update cart item
        const updatedCart = await tx.cart.update({
          where: { userId },
          data: {
            items: {
              update: {
                where: { id: updateCartItemDto.cartItemId },
                data: { quantity: updateCartItemDto.quantity },
              },
            },
          },
          include: {
            items: {
              include: PublicCartHelper.getCartItemIncludeClause(),
            },
          },
        });

        return CartResponseDto.fromCart(updatedCart);
      });

      // Clear cache for this user's cart (outside transaction)
      await this.clearCartCache(userId);
    } catch (error) {
      PublicCartHelper.handleError(error, 'updateCartItem method', this.logger);
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(
    userId: string,
    removeFromCartDto: RemoveFromCartDto,
  ): Promise<CartResponseDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Verify cart item belongs to user and delete it
        const deletedItem = await tx.cartItem.deleteMany({
          where: {
            id: removeFromCartDto.cartItemId,
            cart: { userId },
          },
        });

        if (deletedItem.count === 0) {
          throw new Error('Cart item not found');
        }

        // Get updated cart
        const updatedCart = await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              include: PublicCartHelper.getCartItemIncludeClause(),
            },
          },
        });

        return CartResponseDto.fromCart(updatedCart);
      });

      // Clear cache for this user's cart (outside transaction)
      await this.clearCartCache(userId);
    } catch (error) {
      PublicCartHelper.handleError(error, 'removeFromCart method', this.logger);
    }
  }

  /**
   * Get user's cart with pagination and filtering
   */
  async getCart(
    userId: string,
    query?: CartItemQueryDto,
  ): Promise<PaginatedCartResponseDto> {
    try {
      const cacheKey = PublicCartHelper.generatePublicCartCacheKey(
        userId,
        query,
      );
      const cachedData =
        await this.cacheManager.get<PaginatedCartResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query?.page || PUBLIC_CART_CONSTANTS.DEFAULT_PAGE;
      const limit = query?.pageSize || PUBLIC_CART_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      // Get cart
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            orderBy: PublicCartHelper.buildCartItemOrderBy(query),
            skip,
            take: limit,
            include: PublicCartHelper.getCartItemIncludeClause(),
          },
        },
      });

      if (!cart) {
        // Return empty cart response
        const emptyResponse = PaginatedCartResponseDto.fromPaginatedCart({
          cart: { id: '', userId },
          items: [],
          wholeCartTotals: { totalQuantity: 0, totalPrice: 0, totalItems: 0 },
          page,
          totalPages: 0,
        });

        await this.cacheManager.set(
          cacheKey,
          emptyResponse,
          PUBLIC_CART_CONSTANTS.CACHE_TTL,
        );

        return emptyResponse;
      }

      // Get total count for pagination
      const totalItems = await this.prisma.cartItem.count({
        where: {
          cartId: cart.id,
        },
      });

      // Get all items for calculating totals
      const allItems = await this.prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: PublicCartHelper.getCartItemIncludeClause(),
      });

      const wholeCartTotals = PublicCartHelper.calculateCartTotals(allItems);

      const paginatedResponse = PaginatedCartResponseDto.fromPaginatedCart({
        cart: { id: cart.id, userId: cart.userId },
        items: cart.items,
        wholeCartTotals,
        page,
        totalPages: Math.ceil(totalItems / limit),
      });

      // Cache the response
      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        PUBLIC_CART_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      PublicCartHelper.handleError(error, 'getCart method', this.logger);
    }
  }

  /**
   * Get total count of items in user's cart
   */
  async getCartCount(
    userId: string,
  ): Promise<{ totalItems: number; totalQuantity: number }> {
    try {
      const cacheKey = `public-cart-count:${userId}`;
      const cachedData = await this.cacheManager.get<{
        totalItems: number;
        totalQuantity: number;
      }>(cacheKey);

      if (cachedData) return cachedData;

      // Get cart
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: PublicCartHelper.getCartItemIncludeClause(),
          },
        },
      });

      if (!cart) {
        const emptyCount = { totalItems: 0, totalQuantity: 0 };
        await this.cacheManager.set(
          cacheKey,
          emptyCount,
          PUBLIC_CART_CONSTANTS.CACHE_TTL,
        );
        return emptyCount;
      }

      // Calculate totals using transformed products for accurate pricing
      const totalItems = cart.items.length;
      const totalQuantity = cart.items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );

      const countData = { totalItems, totalQuantity };

      // Cache the response
      await this.cacheManager.set(
        cacheKey,
        countData,
        PUBLIC_CART_CONSTANTS.CACHE_TTL,
      );

      return countData;
    } catch (error) {
      PublicCartHelper.handleError(error, 'getCartCount method', this.logger);
    }
  }

  /**
   * Validate cart items before checkout to prevent checkout failures
   */
  async validateCartForCheckout(
    userId: string,
    warehouseId?: string,
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validItems: any[];
    invalidItems: any[];
  }> {
    try {
      // Get raw cart data for validation (before DTO transformation)
      const rawCart = await this.prisma.cart.findUnique({
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
        // No warehouse specified - use optimal warehouse selection based on product inventories
        const productIds = rawCart.items.map((item) => item.product.id);

        try {
          // Import CheckoutHelper to use optimal warehouse selection
          const { CheckoutHelper } = await import(
            '../../e-commerce/checkout/checkout.helper'
          );
          const optimalWarehouse = await CheckoutHelper.selectOptimalWarehouse(
            this.prisma,
            productIds,
          );
          targetWarehouseId = optimalWarehouse.id;

          this.logger.log(
            `No warehouse specified for cart validation, selected optimal warehouse: ${optimalWarehouse.name} (${optimalWarehouse.id})`,
          );
        } catch (error) {
          // Fallback to default warehouse if optimal selection fails
          this.logger.warn(
            `Optimal warehouse selection failed, falling back to default warehouse: ${error.message}`,
          );

          const defaultWarehouse = await this.prisma.warehouse.findFirst({
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
      }

      for (const item of rawCart.items) {
        try {
          const product = item.product;

          console.log(product.inventories);

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

          // Validate quantity constraints
          if (product.minQuantity && item.quantity < product.minQuantity) {
            errors.push(
              `Sản phẩm "${product.name}" yêu cầu đặt tối thiểu ${product.minQuantity} sản phẩm`,
            );
            invalidItems.push(item);
            continue;
          }

          if (product.maxQuantity && item.quantity > product.maxQuantity) {
            errors.push(
              `Sản phẩm "${product.name}" chỉ cho phép đặt tối đa ${product.maxQuantity} sản phẩm`,
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
      this.logger.error(
        `Error validating cart for checkout: ${error.message}`,
        error.stack,
      );
      return {
        isValid: false,
        errors: [`Lỗi khi kiểm tra giỏ hàng: ${error.message}`],
        warnings: [],
        validItems: [],
        invalidItems: [],
      };
    }
  }

  /**
   * Clean up invalid cart items automatically
   */
  async cleanupInvalidCartItems(userId: string): Promise<{
    removedCount: number;
    removedItems: string[];
  }> {
    try {
      // Get default warehouse first to avoid validation failures
      const defaultWarehouse = await this.prisma.warehouse.findFirst({
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (!defaultWarehouse) {
        this.logger.warn('No active warehouse found for cart validation');
        return { removedCount: 0, removedItems: [] };
      }

      const validationResult = await this.validateCartForCheckout(
        userId,
        defaultWarehouse.id,
      );

      if (validationResult.isValid) {
        return { removedCount: 0, removedItems: [] };
      }

      const removedItems: string[] = [];
      let removedCount = 0;

      // Remove invalid items
      for (const invalidItem of validationResult.invalidItems) {
        try {
          await this.prisma.cartItem.delete({
            where: { id: invalidItem.id },
          });
          removedItems.push(invalidItem.product.name);
          removedCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to remove invalid cart item ${invalidItem.id}: ${error.message}`,
          );
        }
      }

      // Clear cache after cleanup
      if (removedCount > 0) {
        await this.clearCartCache(userId);
      }

      this.logger.log(
        `Cleaned up ${removedCount} invalid cart items for user ${userId}`,
      );

      return { removedCount, removedItems };
    } catch (error) {
      this.logger.error(
        `Error cleaning up invalid cart items: ${error.message}`,
        error.stack,
      );
      return { removedCount: 0, removedItems: [] };
    }
  }

  /**
   * Get cart with validation and automatic cleanup
   */
  async getValidatedCart(
    userId: string,
    query?: CartItemQueryDto,
    autoCleanup: boolean = true,
  ): Promise<PaginatedCartResponseDto> {
    try {
      // First, get the cart
      const cart = await this.getCart(userId, query);

      // If auto-cleanup is enabled and cart has items, validate and clean up
      if (autoCleanup && cart.items && cart.items.length > 0) {
        const cleanupResult = await this.cleanupInvalidCartItems(userId);

        if (cleanupResult.removedCount > 0) {
          // Re-fetch the cart after cleanup
          return await this.getCart(userId, query);
        }
      }

      return cart;
    } catch (error) {
      PublicCartHelper.handleError(
        error,
        'getValidatedCart method',
        this.logger,
      );
    }
  }

  /**
   * Clear cart cache for user
   */
  private async clearCartCache(userId: string): Promise<void> {
    try {
      const cachePattern = `public-cart:${userId}:*`;
      const countCacheKey = `public-cart-count:${userId}`;

      // Clear both paginated cart cache and count cache
      await this.cacheManager.del(cachePattern);
      await this.cacheManager.del(countCacheKey);
    } catch (error) {
      this.logger.warn(
        `Failed to clear cart cache for user ${userId}: ${error.message}`,
      );
    }
  }
}
