import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicBusinessQueryDto } from './dto/public-business-query.dto';

export class PublicBusinessHelper {
  private static readonly logger = new Logger(PublicBusinessHelper.name);

  /**
   * Generate cache key for public businesses with query parameters
   */
  static generatePublicBusinessesCacheKey(
    query?: PublicBusinessQueryDto,
  ): string {
    if (!query) return 'public-businesses:default';
    return `public-businesses:${JSON.stringify(query)}`;
  }

  static buildPublicBusinessWhereClause(
    query?: PublicBusinessQueryDto,
  ): Prisma.BusinessWhereInput {
    const where: Prisma.BusinessWhereInput = {
      // Only show active businesses for public API
      isActive: true,
    };

    if (!query) {
      return where;
    }

    // Search query (name or description)
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Category filtering (businesses that have products in this category)
    if (query.categoryId) {
      where.products = {
        some: {
          categoryId: query.categoryId,
          isActive: true,
          allowsSale: true,
        },
      };
    }

    // Specialty filtering (using description field as fallback)
    if (query.specialty && query.specialty.length > 0) {
      where.description = {
        contains: query.specialty.join(' '),
        mode: 'insensitive',
      };
    }

    // Verified filter
    if (query.verified !== undefined) {
      where.verified = query.verified;
    }

    // Rating filter
    if (query.minRating !== undefined) {
      where.rating = {
        gte: query.minRating,
      };
    }

    // Delivery SLA filter (using responseTime field as fallback)
    if (query.maxDeliverySlaMinutes !== undefined) {
      // Convert minutes to hours for comparison with responseTime field
      const maxHours = Math.ceil(query.maxDeliverySlaMinutes / 60);
      where.responseTime = {
        lte: `${maxHours}h`,
      };
    }

    // Product count filter
    if (query.minProductCount !== undefined) {
      where.productCount = {
        gte: query.minProductCount,
      };
    }

    return where;
  }

  static buildPublicBusinessOrderBy(
    query?: PublicBusinessQueryDto,
  ): Prisma.BusinessOrderByWithRelationInput[] {
    if (!query || !query.sortBy) {
      // Default sorting for public businesses (newest first, then by name)
      return [{ createdAt: 'desc' }, { name: 'asc' }];
    }

    const direction = query.sortDir || 'asc';
    const orderBy: Prisma.BusinessOrderByWithRelationInput[] = [];

    switch (query.sortBy) {
      case 'name':
        orderBy.push({ name: direction });
        break;
      case 'rating':
        orderBy.push({ rating: direction });
        break;
      case 'productCount':
        orderBy.push({ products: { _count: direction } });
        break;
      case 'growthRate':
        // For growth rate, we might need to handle this differently
        // For now, use createdAt as fallback
        orderBy.push({ createdAt: direction });
        break;
      case 'createdAt':
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

  static getPublicBusinessIncludeClause() {
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

  static getDetailedBusinessIncludeClause() {
    return {
      products: {
        where: {
          isActive: true,
          allowsSale: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          thumbnail: true,
          price: true,
          // Remove rating field as it doesn't exist on Product model
          // rating: true,
        },
        take: 10, // Limit products for business detail
        orderBy: {
          createdAt: 'desc' as const,
        },
      },
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
   * Transform business data for public API response
   */
  static transformBusinessForPublicResponse(business: any) {
    // Calculate product count
    const productCount =
      business.productCount || business._count?.products || 0;

    // Calculate rating average
    const rating = {
      average: business.rating || 0,
      count: business.totalRatings || 0,
    };

    // Format customer count display (using followers as proxy)
    const customerCount = business.followers || 0;
    const customerCountDisplay = this.formatNumberDisplay(customerCount);

    // Format growth rate display (mock implementation)
    const growthRate = 0; // This would need to be calculated from actual data
    const growthRateDisplay =
      growthRate > 0 ? `+${growthRate}%` : `${growthRate}%`;

    // Format delivery SLA display (using responseTime)
    const responseTime = business.responseTime;
    const deliverySlaDisplay = responseTime ? responseTime : undefined;

    return {
      ...business,
      productCount,
      rating,
      customerCount,
      customerCountDisplay,
      growthRate,
      growthRateDisplay,
      deliverySlaMinutes: undefined, // Not available in schema
      deliverySlaDisplay,
      badges: this.generateBusinessBadges(business),
    };
  }

  /**
   * Transform business data for detailed public API response
   */
  static transformBusinessForDetailedResponse(business: any) {
    // Calculate product count
    const productCount =
      business.productCount || business._count?.products || 0;

    // Calculate rating average
    const rating = {
      average: business.rating || 0,
      count: business.totalRatings || 0,
    };

    // Format customer count display (using followers as proxy)
    const customerCount = business.followers || 0;
    const customerCountDisplay = this.formatNumberDisplay(customerCount);

    // Format growth rate display (mock implementation)
    const growthRate = 0; // This would need to be calculated from actual data
    const growthRateDisplay =
      growthRate > 0 ? `+${growthRate}%` : `${growthRate}%`;

    // Format delivery SLA display (using responseTime)
    const responseTime = business.responseTime;
    const deliverySlaDisplay = responseTime ? responseTime : undefined;

    // Process specialty (using description as fallback)
    const specialty = business.description ? [business.description] : undefined;

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl:
        business.logo || business.avatar || business.avatarUrl || undefined,
      description: business.description || undefined,
      verified: !!business.verified,
      badge: business.badge || undefined,
      trustScore: business.trustScore || undefined,
      rating,
      productCount,
      deliverySlaMinutes: undefined, // Not available in schema
      deliverySlaDisplay,
      onTimeRate30d: undefined, // Not available in schema
      cancelRate30d: undefined, // Not available in schema
      customerCount,
      customerCountDisplay,
      growthRate,
      growthRateDisplay,
      specialty,
      createdAt: business.createdAt,
    };
  }

  private static formatNumberDisplay(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K+`;
    }
    return `${num}+`;
  }

  private static formatDeliverySlaDisplay(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} phút`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      }
      return `${hours}h${remainingMinutes}m`;
    } else {
      const days = Math.floor(minutes / 1440);
      return `${days} ngày`;
    }
  }

  private static generateBusinessBadges(business: any): string[] {
    const badges: string[] = [];

    if (business.verified) badges.push('Đã xác thực');
    if (business.rating && business.rating >= 4.5) badges.push('Đánh giá cao');
    if (business.responseTime && business.responseTime.includes('1h')) {
      badges.push('Phản hồi nhanh');
    }
    if (
      business.createdAt &&
      new Date(business.createdAt) >
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ) {
      badges.push('Mới tham gia');
    }
    if (business.productCount && business.productCount >= 100) {
      badges.push('Sản phẩm đa dạng');
    }

    return badges;
  }

  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in public businesses - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }
}
