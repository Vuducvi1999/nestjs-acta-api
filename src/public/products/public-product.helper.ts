import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicProductQueryDto } from './dto/public-product-query.dto';

export class PublicProductHelper {
  private static readonly logger = new Logger(PublicProductHelper.name);

  /**
   * Generate cache key for public products with query parameters
   */
  static generatePublicProductsCacheKey(query?: PublicProductQueryDto): string {
    if (!query) return 'public-products:default';
    return `public-products:${JSON.stringify(query)}`;
  }

  static buildPublicProductWhereClause(
    query?: PublicProductQueryDto,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      // Only show active products that allow sale for public API
      isActive: true,
      allowsSale: true,
    };

    if (!query) {
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

    // Free shipping filter
    if (query.freeShipping !== undefined) {
      where.freeShipping = query.freeShipping;
    }

    // Stock status filtering
    if (query.stockStatus) {
      // Filter based on inventory stock levels
      switch (query.stockStatus) {
        case 'in_stock':
          where.inventories = {
            some: {
              onHand: { gt: 10 },
            },
          };
          break;
        case 'low_stock':
          where.inventories = {
            some: {
              onHand: { gte: 1, lte: 10 },
            },
          };
          break;
        case 'out_of_stock':
          where.inventories = {
            every: {
              onHand: { lte: 0 },
            },
          };
          break;
      }
    }

    // Category group filtering
    if (query.categoryGroup && query.categoryGroup.length > 0) {
      where.category = {
        name: { in: query.categoryGroup, mode: 'insensitive' },
      };
    }

    return where;
  }

  static buildPublicProductOrderBy(
    query?: PublicProductQueryDto,
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (!query || !query.sortBy) {
      // Default sorting for public products (popular first, then newest)
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
      case 'rating':
        // For rating, we might need to handle this differently
        // For now, use createdAt as fallback
        orderBy.push({ createdAt: direction });
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

  static getPublicProductIncludeClause() {
    return {
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
        take: 5, // Limit images for public API
      },
      _count: {
        select: {
          ratings: true,
          variants: true,
        },
      },
    };
  }

  static getDetailedProductIncludeClause() {
    return {
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
          actualReserved: true,
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
      },
      variants: {
        select: {
          id: true,
          sku: true,
          name: true,
          value: true,
          additionalPrice: true,
          stock: true,
        },
      },
      attributes: {
        select: {
          id: true,
          attributeName: true,
          attributeValue: true,
        },
      },
      units: {
        select: {
          id: true,
          name: true,
          unit: true,
          conversionValue: true,
        },
      },
      warranties: {
        select: {
          id: true,
          warrantyType: true,
          numberTime: true,
          timeType: true,
          description: true,
        },
      },
      ratings: {
        select: {
          rating: true,
        },
      },
      reviews: {
        select: {
          id: true,
          rating: true,
          title: true,
          content: true,
          images: true,
          isVerified: true,
          isHelpful: true,
          createdAt: true,
          user: {
            select: {
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc' as const,
        },
        take: 5,
      },
      _count: {
        select: {
          ratings: true,
          variants: true,
          reviews: true,
        },
      },
    };
  }

  /**
   * Transform product data for public API response
   */
  static transformProductForPublicResponse(product: any) {
    // Calculate available stock from inventories
    const available = this.calculateAvailableStock(product.inventories);

    // Calculate stock status
    const stockStatus = this.calculateStockStatus(available);

    // Calculate rating average (mock implementation)
    const rating = {
      average: 0, // You would calculate this from actual ratings
      count: product._count?.ratings || 0,
    };

    // Get the main thumbnail
    const thumbnail =
      product.thumbnail ||
      product.images?.find((img) => img.isMain)?.url ||
      product.images?.[0]?.url ||
      '';

    // Calculate variant info
    const hasVariants = (product._count?.variants || 0) > 0;
    const variantCount = product._count?.variants || 0;

    return {
      ...product,
      // Convert Decimal fields to numbers
      price: Number(product.price),
      basePrice: Number(product.basePrice),
      priceMin: product.priceMin ? Number(product.priceMin) : undefined,
      priceMax: product.priceMax ? Number(product.priceMax) : undefined,
      conversionValue: product.conversionValue
        ? Number(product.conversionValue)
        : undefined,
      thumbnail,
      stockStatus,
      available,
      rating,
      hasVariants,
      variantCount,
      businessName: product.business?.name,
      businessSlug: product.business?.slug,
      categoryName: product.category?.name,
      categorySlug: product.category?.slug,
      badges: this.generateProductBadges(product),
    };
  }

  private static calculateAvailableStock(inventories?: any[]): number {
    if (!inventories || inventories.length === 0) return 0;

    return inventories.reduce((total, inventory) => {
      const availableInInventory = Math.max(
        0,
        (inventory.onHand || 0) - (inventory.reserved || 0),
      );
      return total + availableInInventory;
    }, 0);
  }

  private static calculateStockStatus(
    available?: number,
  ): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (!available || available <= 0) return 'out_of_stock';
    if (available <= 10) return 'low_stock';
    return 'in_stock';
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

  /**
   * Transform product data for detailed public API response
   */
  static transformProductForDetailedResponse(product: any) {
    // Calculate available stock from inventories
    const available = this.calculateAvailableStock(product.inventories);

    // Calculate rating average
    const rating = this.calculateRatingAverage(product.ratings);

    // Get the main thumbnail
    const thumbnail =
      product.thumbnail ||
      product.images?.find((img) => img.isMain)?.url ||
      product.images?.[0]?.url ||
      '';

    // Process images
    const images = (product.images || []).map((img) => ({
      url: img.url,
      isMain: img.isMain,
      sortOrder: img.sortOrder,
    }));

    // Process variants
    const variantOptions = this.extractVariantOptions(product.variants || []);
    const variantItems = (product.variants || []).map((variant) => ({
      sku: variant.sku,
      attributes: { [variant.name]: variant.value },
      additionalPrice: variant.additionalPrice
        ? Number(variant.additionalPrice)
        : 0,
      image: undefined, // No image field in ProductVariant
      stock: variant.stock || 0,
      barCode: undefined, // No barCode field in ProductVariant
      weight: undefined, // No weight field in ProductVariant
    }));

    // Process warranties
    const warrantyItems = (product.warranties || []).map((warranty) => ({
      type: warranty.warrantyType,
      duration: warranty.numberTime,
      timeType: warranty.timeType,
      description: warranty.description,
    }));

    // Calculate tax rate
    const taxRate = this.calculateTaxRate(
      product.taxType,
      product.taxRateDirect,
    );

    return {
      id: product.id,
      slug: product.slug,
      code: product.code,
      name: product.name,
      description: product.description,
      type: product.type,
      thumbnail,
      images,
      brand: {
        id: product.business?.id || product.businessId,
        name: product.business?.name || '',
        slug: product.business?.slug || '',
      },
      category: {
        id: product.category?.id || product.categoryId,
        name: product.category?.name || '',
        slug: product.category?.slug || '',
        breadcrumbs: [], // Would need to implement breadcrumb logic
      },
      pricing: {
        price: Number(product.price),
        originalPrice: Number(product.basePrice),
        currency: 'VND' as const,
        display: 'tax_included' as const,
        tax: product.taxType
          ? {
              type: product.taxType,
              rate: taxRate,
              name: product.taxName,
            }
          : undefined,
        priceMin: product.priceMin ? Number(product.priceMin) : undefined,
        priceMax: product.priceMax ? Number(product.priceMax) : undefined,
      },
      unit: {
        default: product.unit || '',
        options: (product.units || []).map((unit) => ({
          id: unit.id,
          name: unit.name,
          unit: unit.unit,
          conversionValue: Number(unit.conversionValue),
        })),
      },
      variants: {
        options: variantOptions,
        items: variantItems,
      },
      availability: {
        available,
        minQuantity: product.minQuantity || 1,
        maxQuantity: product.maxQuantity,
      },
      shipping: {
        freeShipping: product.freeShipping || false,
        weight: product.weight,
        dimensions: product.dimensions,
      },
      warranty:
        warrantyItems.length > 0
          ? {
              summary: this.generateWarrantySummary(warrantyItems),
              items: warrantyItems,
            }
          : undefined,
      specifications: product.specifications || {},
      attributes: (product.attributes || []).map((attr) => ({
        name: attr.attributeName,
        value: attr.attributeValue,
      })),
      rating,
      topReviews: this.transformReviews(product.reviews || []),
      seo: {
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        keywords: product.keywords || [],
        canonicalUrl: `/products/${product.slug}`,
      },
      badges: this.generateProductBadges(product),
      updatedAt: product.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private static extractVariantOptions(
    variants: any[],
  ): Array<{ name: string; values: string[] }> {
    const optionsMap = new Map<string, Set<string>>();

    variants.forEach((variant) => {
      if (variant.name && variant.value) {
        if (!optionsMap.has(variant.name)) {
          optionsMap.set(variant.name, new Set());
        }
        optionsMap.get(variant.name)?.add(String(variant.value));
      }
    });

    return Array.from(optionsMap.entries()).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet),
    }));
  }

  private static calculateRatingAverage(ratings: any[]): {
    average: number;
    count: number;
  } {
    if (!ratings || ratings.length === 0) {
      return { average: 0, count: 0 };
    }

    const sum = ratings.reduce((acc, rating) => acc + (rating.rating || 0), 0);
    return {
      average: Math.round((sum / ratings.length) * 10) / 10,
      count: ratings.length,
    };
  }

  private static calculateTaxRate(
    taxType: any,
    taxRateDirect?: number,
  ): number | undefined {
    if (taxRateDirect) return taxRateDirect;

    // Map tax type to rate
    const taxRates = {
      zero: 0,
      five: 5,
      eight: 8,
      ten: 10,
      kct: 10, // Assuming KCT is 10%
      kkknt: 5, // Assuming KKKNT is 5%
      khac: 0, // Other
    };

    return taxRates[taxType as keyof typeof taxRates];
  }

  private static generateWarrantySummary(warranties: any[]): string {
    if (warranties.length === 0) return 'Không có bảo hành';

    const mainWarranty = warranties[0];
    const timeTypeMap = {
      day: 'ngày',
      month: 'tháng',
      year: 'năm',
    };

    const timeText =
      timeTypeMap[mainWarranty.timeType as keyof typeof timeTypeMap] || '';
    return `Bảo hành ${mainWarranty.duration} ${timeText}`;
  }

  private static transformReviews(reviews: any[]) {
    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      content: review.content,
      images: review.images || [],
      isVerified: review.isVerified || false,
      likeCount: review.isHelpful || 0,
      createdAt: review.createdAt?.toISOString() || new Date().toISOString(),
      user: {
        displayName: this.anonymizeUserName(review.user?.fullName || 'Ẩn danh'),
        avatarUrl: review.user?.avatar?.fileUrl,
      },
    }));
  }

  private static anonymizeUserName(fullName: string): string {
    if (!fullName || fullName.length <= 3) return 'Ẩn danh';

    const parts = fullName.split(' ');
    if (parts.length === 1) {
      return `${parts[0].charAt(0)}***`;
    }

    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName.charAt(0)}***`;
  }

  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in public products - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }
}
