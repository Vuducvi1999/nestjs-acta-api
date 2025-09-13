import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CartItemQueryDto } from './dto/public-cart-query.dto';
import { PublicProductHelper } from '../products/public-product.helper';

export class PublicCartHelper {
  private static readonly logger = new Logger(PublicCartHelper.name);

  /**
   * Generate cache key for public cart with query parameters
   */
  static generatePublicCartCacheKey(
    userId: string,
    query?: CartItemQueryDto,
  ): string {
    if (!query) return `public-cart:${userId}:default`;
    return `public-cart:${userId}:${JSON.stringify(query)}`;
  }

  /**
   * Build where clause for cart items query
   */
  static buildCartItemWhereClause(
    userId: string,
    query?: CartItemQueryDto,
  ): Prisma.CartItemWhereInput {
    const where: any = {
      cart: {
        userId,
      },
    };

    if (!query) {
      return where;
    }

    // Product filtering
    if (query.productId) {
      where.productId = query.productId;
    }

    // Category filtering (through product)
    if (query.categoryId) {
      where.product = {
        categoryId: query.categoryId,
      };
    }

    // Business filtering (through product)
    if (query.businessId) {
      where.product = {
        ...where.product,
        businessId: query.businessId,
      };
    }

    // Search query (product name/code/sku)
    if (query.q) {
      where.product = {
        ...where.product,
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { code: { contains: query.q, mode: 'insensitive' } },
          { sku: { contains: query.q, mode: 'insensitive' } },
        ],
      };
    }

    // Quantity range filtering
    if (query.minQuantity !== undefined || query.maxQuantity !== undefined) {
      where.quantity = {} as any;
      if (query.minQuantity !== undefined) {
        (where.quantity as any).gte = query.minQuantity;
      }
      if (query.maxQuantity !== undefined) {
        (where.quantity as any).lte = query.maxQuantity;
      }
    }

    // Price range filtering (through product)
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.product = {
        ...where.product,
        price: {},
      };
      if (query.minPrice !== undefined && where.product?.price) {
        (where.product.price as any).gte = query.minPrice;
      }
      if (query.maxPrice !== undefined && where.product?.price) {
        (where.product.price as any).lte = query.maxPrice;
      }
    }

    // Date range filtering
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) {
        where.createdAt.gte = new Date(query.createdFrom);
      }
      if (query.createdTo) {
        where.createdAt.lte = new Date(query.createdTo);
      }
    }

    if (query.updatedFrom || query.updatedTo) {
      where.updatedAt = {};
      if (query.updatedFrom) {
        where.updatedAt.gte = new Date(query.updatedFrom);
      }
      if (query.updatedTo) {
        where.updatedAt.lte = new Date(query.updatedTo);
      }
    }

    return where as Prisma.CartItemWhereInput;
  }

  /**
   * Build order by clause for cart items query
   */
  static buildCartItemOrderBy(
    query?: CartItemQueryDto,
  ): Prisma.CartItemOrderByWithRelationInput[] {
    const sortBy = query?.sortBy || 'createdAt';
    const sortDir = query?.sortDir || 'desc';

    switch (sortBy) {
      case 'name':
        return [{ product: { name: sortDir } }];
      case 'price':
        return [{ product: { price: sortDir } }];
      case 'quantity':
        return [{ quantity: sortDir }];
      case 'subtotal':
        // For subtotal, we need to sort by quantity * price
        // This is handled in the service layer
        return [{ quantity: sortDir }];
      case 'updatedAt':
        return [{ updatedAt: sortDir }];
      case 'createdAt':
      default:
        return [{ createdAt: sortDir }];
    }
  }

  /**
   * Get include clause for cart items with product details
   */
  static getCartItemIncludeClause(): Prisma.CartItemInclude {
    return {
      product: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          business: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          masterProduct: {
            select: {
              id: true,
              name: true,
            },
          },
          inventories: {
            select: {
              onHand: true,
              reserved: true,
            },
          },
          images: {
            select: {
              id: true,
              url: true,
              sortOrder: true,
              isMain: true,
            },
            orderBy: {
              sortOrder: 'asc' as const,
            },
            take: 5,
          },
          _count: {
            select: {
              ratings: true,
              variants: true,
            },
          },
        },
      },
    };
  }

  /**
   * Get include clause for detailed cart with all items
   */
  static getDetailedCartIncludeClause(): Prisma.CartInclude {
    return {
      items: {
        include: this.getCartItemIncludeClause(),
        orderBy: { createdAt: 'desc' },
      },
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
        },
      },
    };
  }

  /**
   * Validate product availability for cart addition
   */
  static validateProductForCart(product: any): void {
    if (!product) {
      throw new BadRequestException('Sản phẩm không tồn tại');
    }

    if (!product.isActive) {
      throw new BadRequestException('Sản phẩm không còn hoạt động');
    }

    if (!product.allowsSale) {
      throw new BadRequestException('Sản phẩm không cho phép bán');
    }

    // Check if product has valid business information
    if (!product.businessId) {
      throw new BadRequestException(
        'Sản phẩm không có thông tin doanh nghiệp hợp lệ',
      );
    }

    // Check if product has minimum quantity requirement
    if (product.minQuantity && product.minQuantity > 1) {
      throw new BadRequestException(
        `Sản phẩm yêu cầu đặt tối thiểu ${product.minQuantity} sản phẩm`,
      );
    }

    // Check if product has maximum quantity limit
    if (product.maxQuantity && product.maxQuantity > 0) {
      throw new BadRequestException(
        `Sản phẩm chỉ cho phép đặt tối đa ${product.maxQuantity} sản phẩm`,
      );
    }

    // Check stock availability
    const inventory = product.inventories?.[0];
    if (inventory && inventory.onHand <= 0) {
      throw new BadRequestException('Sản phẩm đã hết hàng');
    }
  }

  /**
   * Check if quantity is available in stock
   */
  static checkStockAvailability(product: any, requestedQuantity: number): void {
    const inventory = product.inventories?.[0];
    if (inventory && inventory.onHand < requestedQuantity) {
      throw new BadRequestException(
        `Chỉ còn ${inventory.onHand} sản phẩm trong kho`,
      );
    }

    // Check minimum quantity requirement
    if (product.minQuantity && requestedQuantity < product.minQuantity) {
      throw new BadRequestException(
        `Sản phẩm yêu cầu đặt tối thiểu ${product.minQuantity} sản phẩm`,
      );
    }

    // Check maximum quantity limit
    if (product.maxQuantity && requestedQuantity > product.maxQuantity) {
      throw new BadRequestException(
        `Sản phẩm chỉ cho phép đặt tối đa ${product.maxQuantity} sản phẩm`,
      );
    }
  }

  /**
   * Validate product has inventory in specific warehouse
   */
  static validateProductInventoryInWarehouse(
    product: any,
    warehouseId: string,
  ): void {
    if (!product.inventories || product.inventories.length === 0) {
      throw new BadRequestException(
        `Sản phẩm ${product.name} không có tồn kho trong kho hàng`,
      );
    }

    // Check if product has inventory in the specific warehouse
    const warehouseInventory = product.inventories.find(
      (inv) => inv.warehouseId === warehouseId,
    );
    if (!warehouseInventory) {
      throw new BadRequestException(
        `Sản phẩm ${product.name} không có tồn kho trong kho hàng được chọn`,
      );
    }

    if (warehouseInventory.onHand <= 0) {
      throw new BadRequestException(
        `Sản phẩm ${product.name} đã hết hàng trong kho hàng được chọn`,
      );
    }
  }

  /**
   * Calculate cart totals
   */
  static calculateCartTotals(items: any[]): {
    totalQuantity: number;
    totalPrice: number;
    totalItems: number;
  } {
    return items.reduce(
      (totals, item) => {
        // Transform product to ensure proper price formatting
        const transformedProduct =
          PublicProductHelper.transformProductForPublicResponse(item.product);

        return {
          totalQuantity: totals.totalQuantity + item.quantity,
          totalPrice:
            totals.totalPrice + transformedProduct.price * item.quantity,
          totalItems: totals.totalItems + 1,
        };
      },
      { totalQuantity: 0, totalPrice: 0, totalItems: 0 },
    );
  }

  /**
   * Handle errors consistently across cart operations
   */
  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in public cart - ${operation}: ${error.message}`,
      error.stack,
    );

    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(`Không thể ${operation}`);
  }
}
