import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { USER_SELECT_FIELDS_WITH_AUTH } from '../../posts/posts.constants';
import { ProductQueryDto } from './dto/product-query.dto';

export class ProductsHelper {
  private static readonly logger = new Logger(ProductsHelper.name);

  /**
   * Generate cache key for products with query parameters
   */
  static generateProductsCacheKey(query?: ProductQueryDto): string {
    if (!query) return 'products:default';
    return `products:${JSON.stringify(query)}`;
  }

  static async validateAndFetchUser(prisma: PrismaService, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT_FIELDS_WITH_AUTH,
    });

    if (!user) {
      throw new NotFoundException('User not authenticated');
    }

    if (user.role !== Role.admin) {
      throw new ForbiddenException('User does not have permission');
    }

    return user;
  }

  static buildProductWhereClause(
    query?: ProductQueryDto,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (!query) {
      // Default filters when no query provided
      where.isActive = true;
      where.allowsSale = true;
      return where;
    }

    // Search query (name or description)
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Category filtering
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    // Business filtering
    if (query.businessId) {
      where.businessId = query.businessId;
    }

    // Price range filtering
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = query.maxPrice;
      }
    }

    // Boolean filters
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.allowsSale !== undefined) {
      where.allowsSale = query.allowsSale;
    }

    if (query.freeShipping !== undefined) {
      where.freeShipping = query.freeShipping;
    }

    if (query.isRewardPoint !== undefined) {
      where.isRewardPoint = query.isRewardPoint;
    }

    // Tax type filtering
    if (query.taxType && query.taxType.length > 0) {
      where.taxType = { in: query.taxType };
    }

    // Source filtering
    if (query.source) {
      where.source = query.source as any;
    }

    // Category group filtering (would need to be implemented with category relations)
    if (query.categoryGroup && query.categoryGroup.length > 0) {
      where.category = {
        name: { in: query.categoryGroup, mode: 'insensitive' },
      };
    }

    return where;
  }

  static buildProductOrderBy(
    query?: ProductQueryDto,
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (!query || !query.sortBy) {
      // Default sorting
      return [{ createdAt: 'desc' }, { name: 'asc' }];
    }

    const direction = query.sortDir || 'asc';
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [];

    switch (query.sortBy) {
      case 'name':
        orderBy.push({ name: direction });
        break;
      case 'price':
        orderBy.push({ price: direction });
        break;
      case 'createdAt':
        orderBy.push({ createdAt: direction });
        break;
      case 'updatedAt':
        orderBy.push({ updatedAt: direction });
        break;
      default:
        orderBy.push({ createdAt: 'desc' });
    }

    // Always add a secondary sort for consistency
    if (query.sortBy !== 'name') {
      orderBy.push({ name: 'asc' });
    }

    return orderBy;
  }

  static getProductIncludeClause() {
    return {
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
      masterProduct: {
        select: {
          id: true,
          name: true,
        },
      },
      masterUnit: {
        select: {
          id: true,
          name: true,
        },
      },
      orderTemplate: true,
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
      },
      _count: {
        select: {
          inventories: true,
          ratings: true,
          reviews: true,
          featuredIn: true,
          orderDetails: true,
          cartItems: true,
          wishlistItems: true,
          variants: true,
          attributes: true,
          units: true,
          priceBooks: true,
          formulas: true,
          serials: true,
          batchExpires: true,
          warranties: true,
          shelves: true,
          invoiceDetails: true,
          purchaseOrderDetails: true,
          returnOrderDetails: true,
          transferDetails: true,
          orderBusinessDetails: true,
        },
      },
    };
  }

  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in products - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }
}
