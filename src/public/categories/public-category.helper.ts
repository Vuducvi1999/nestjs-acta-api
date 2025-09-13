import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicCategoryQueryDto } from './dto/public-category-query.dto';

export class PublicCategoryHelper {
  private static readonly logger = new Logger(PublicCategoryHelper.name);

  /**
   * Generate cache key for public categories with query parameters
   */
  static generatePublicCategoriesCacheKey(
    query?: PublicCategoryQueryDto,
  ): string {
    if (!query) return 'public-categories:default';
    return `public-categories:${JSON.stringify(query)}`;
  }

  static buildPublicCategoryWhereClause(
    query?: PublicCategoryQueryDto,
  ): Prisma.CategoryWhereInput {
    const where: Prisma.CategoryWhereInput = {
      // Only show active categories for public API
      isActive: true,
    };

    if (!query) {
      return where;
    }

    // Search query (name, slug, or description)
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Parent filtering
    if (query.parentId) {
      where.parentId = query.parentId;
    }

    // Root category filtering
    if (query.isRoot !== undefined) {
      where.isRoot = query.isRoot;
    }

    // Active status filtering
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Group filtering
    if (query.group && query.group.length > 0) {
      where.group = { in: query.group };
    }

    // Stock status filtering (via product join)
    if (query.stockStatus) {
      where.products = {
        some: {
          isActive: true,
          allowsSale: true,
          inventories: {
            some: this.buildStockStatusFilter(query.stockStatus),
          },
        },
      };
    }

    return where;
  }

  private static buildStockStatusFilter(
    stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock',
  ): any {
    switch (stockStatus) {
      case 'in_stock':
        return { onHand: { gt: 10 } };
      case 'low_stock':
        return { onHand: { gte: 1, lte: 10 } };
      case 'out_of_stock':
        return { onHand: { lte: 0 } };
      default:
        return {};
    }
  }

  static buildPublicCategoryOrderBy(
    query?: PublicCategoryQueryDto,
  ): Prisma.CategoryOrderByWithRelationInput[] {
    if (!query || !query.sortBy) {
      // Default sorting for public categories (sort order first, then name)
      return [{ sortOrder: 'asc' }, { name: 'asc' }];
    }

    const direction = query.sortDir || 'asc';
    const orderBy: Prisma.CategoryOrderByWithRelationInput[] = [];

    switch (query.sortBy) {
      case 'name':
        orderBy.push({ name: direction });
        break;
      case 'createdAt':
        orderBy.push({ createdAt: direction });
        break;
      case 'updatedAt':
        orderBy.push({ updatedAt: direction });
        break;
      case 'productCount':
        // For product count, we need to use a different approach
        // For now, use sortOrder as fallback
        orderBy.push({ sortOrder: 'asc' as const });
        break;
      default:
        orderBy.push({ sortOrder: 'asc' as const });
    }

    // Always add a secondary sort for consistency
    if (query.sortBy !== 'name') {
      orderBy.push({ name: 'asc' as const });
    }

    return orderBy;
  }

  static getPublicCategoryIncludeClause() {
    return {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      children: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
        },
        orderBy: { sortOrder: 'asc' as const },
        take: 10, // Limit children for public API
      },
      _count: {
        select: {
          products: {
            where: {
              isActive: true,
              allowsSale: true,
            },
          },
          children: {
            where: { isActive: true },
          },
        },
      },
    };
  }

  static getDetailedCategoryIncludeClause(includeFeatured: boolean = false) {
    const baseInclude = {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      children: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          _count: {
            select: {
              products: {
                where: {
                  isActive: true,
                  allowsSale: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      siblings: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      _count: {
        select: {
          products: {
            where: {
              isActive: true,
              allowsSale: true,
            },
          },
          children: {
            where: { isActive: true },
          },
        },
      },
    };

    if (includeFeatured) {
      return {
        ...baseInclude,
        products: {
          where: {
            isActive: true,
            allowsSale: true,
            // You might have a 'featured' field or use other criteria
            // isFeatured: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnail: true,
            price: true,
            basePrice: true,
            hasVariants: true,
            priceMin: true,
            priceMax: true,
            _count: {
              select: {
                ratings: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' as const }, { name: 'asc' as const }],
          take: 8,
        },
      };
    }

    return baseInclude;
  }

  static getCategoryTreeIncludeClause(
    withCounts: boolean = false,
    maxDepth: number = 3,
  ) {
    const buildRecursiveInclude = (depth: number): any => {
      if (depth <= 0) return {};

      return {
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            group: true,
            image: true,
            color: true,
            icon: true,
            ...(withCounts && {
              _count: {
                select: {
                  products: {
                    where: {
                      isActive: true,
                      allowsSale: true,
                    },
                  },
                  children: {
                    where: { isActive: true },
                  },
                },
              },
            }),
            ...buildRecursiveInclude(depth - 1),
          },
          orderBy: { sortOrder: 'asc' as const },
        },
      };
    };

    return {
      ...buildRecursiveInclude(maxDepth),
      ...(withCounts && {
        _count: {
          select: {
            products: {
              where: {
                isActive: true,
                allowsSale: true,
              },
            },
            children: {
              where: { isActive: true },
            },
          },
        },
      }),
    };
  }

  static getCategorySuggestionsIncludeClause() {
    return {
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    };
  }

  static getRelatedCategoryIncludeClause() {
    return {
      _count: {
        select: {
          products: {
            where: {
              isActive: true,
              allowsSale: true,
            },
          },
        },
      },
    };
  }

  /**
   * Transform category data for public API response
   */
  static transformCategoryForPublicResponse(category: any) {
    return {
      ...category,
      productCount: category._count?.products || 0,
      hasChild: (category._count?.children || 0) > 0,
      parentName: category.parent?.name,
      parentSlug: category.parent?.slug,
    };
  }

  /**
   * Transform category data for detailed public API response
   */
  static transformCategoryForDetailedResponse(category: any) {
    // Build breadcrumbs from parent chain
    const breadcrumbs = this.buildBreadcrumbs(category);

    // Process featured products if included
    const featuredProducts = category.products?.map((product: any) => ({
      ...product,
      price: Number(product.price),
      basePrice: Number(product.basePrice),
      priceMin: product.priceMin ? Number(product.priceMin) : undefined,
      priceMax: product.priceMax ? Number(product.priceMax) : undefined,
      rating: {
        average: 0, // You would calculate this from actual ratings
        count: product._count?.ratings || 0,
      },
      badges: this.generateProductBadges(product),
    }));

    return {
      ...category,
      productCount: category._count?.products || 0,
      activeProductCount: category._count?.products || 0,
      parentChain: breadcrumbs,
      featuredProducts,
      parentName: category.parent?.name,
      parentSlug: category.parent?.slug,
    };
  }

  /**
   * Transform category data for suggestions response
   */
  static transformCategoryForSuggestionsResponse(category: any) {
    // Build parent chain for path
    const parentChain = this.buildParentChain(category);

    return {
      ...category,
      parentChain,
    };
  }

  /**
   * Transform category data for related response
   */
  static transformCategoryForRelatedResponse(category: any) {
    return {
      ...category,
      productCount: category._count?.products || 0,
    };
  }

  private static buildBreadcrumbs(
    category: any,
  ): Array<{ id: string; name: string; slug: string }> {
    const breadcrumbs: Array<{ id: string; name: string; slug: string }> = [];

    // Build breadcrumbs from parent chain
    let current = category.parent;
    while (current) {
      breadcrumbs.unshift({
        id: current.id,
        name: current.name,
        slug: current.slug,
      });
      // Note: In a real implementation, you'd need to fetch the full parent chain
      // For now, we only have the immediate parent
      break;
    }

    return breadcrumbs;
  }

  private static buildParentChain(
    category: any,
  ): Array<{ id: string; name: string; slug: string }> {
    const chain: Array<{ id: string; name: string; slug: string }> = [];

    if (category.parent) {
      chain.push({
        id: category.parent.id,
        name: category.parent.name,
        slug: category.parent.slug,
      });
    }

    return chain;
  }

  private static generateProductBadges(product: any): string[] {
    const badges: string[] = [];

    if (product.freeShipping) badges.push('Miễn phí vận chuyển');
    if (product.isRewardPoint) badges.push('Tích điểm');
    if (
      product.createdAt &&
      new Date(product.createdAt) >
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ) {
      badges.push('Mới');
    }

    return badges;
  }

  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in public categories - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }
}
