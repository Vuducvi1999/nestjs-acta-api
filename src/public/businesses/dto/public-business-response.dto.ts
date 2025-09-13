// Keep the structure parallel to PublicProductItemResponseDto & PublicBrandDetailDto
// to minimize FE branching.

export class PublicBusinessItemResponseDto {
  id: string;
  name: string;
  slug: string;

  logoUrl?: string;
  description?: string;

  verified: boolean;
  badge?: string; // e.g., "Đối tác vàng"
  specialty?: string | string[];

  rating: { average: number; count: number };

  productCount: number;

  // Audience & growth
  customerCount?: number; // numeric for filters/sort
  customerCountDisplay?: string; // e.g., "15K+"

  growthRate?: number; // numeric
  growthRateDisplay?: string; // e.g., "+30%"

  // Delivery/SLA
  deliverySlaMinutes?: number; // e.g., 120
  deliverySlaDisplay?: string; // e.g., "1–2h"

  createdAt?: Date;

  constructor(partial: Partial<PublicBusinessItemResponseDto>) {
    Object.assign(this, partial);
  }

  static fromBusiness(business: any): PublicBusinessItemResponseDto {
    // Mirrors your existing PublicBrandDetailDto.fromBusiness mapping
    // and enriches with analytics if present.
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl:
        business.logo || business.avatar || business.avatarUrl || undefined,
      description: business.description || undefined,
      verified: !!business.verified,
      badge: business.badge || undefined,
      specialty: business.specialty || business.tags || undefined,
      rating: {
        average: business.ratingAverage ?? business.rating ?? 0,
        count: business.ratingCount ?? 0,
      },
      productCount: business._count?.products ?? business.productCount ?? 0,
      customerCount: business.customerCount ?? undefined,
      customerCountDisplay: business.customerCountDisplay ?? undefined,
      growthRate: business.salesGrowth30d ?? business.growthRate ?? undefined,
      growthRateDisplay: business.growthRateDisplay ?? undefined,
      deliverySlaMinutes: business.deliverySlaMinutes ?? undefined,
      deliverySlaDisplay: business.deliverySlaDisplay ?? undefined,
      createdAt: business.createdAt,
    };
  }
}

export class PaginatedPublicBusinessResponseDto {
  data: PublicBusinessItemResponseDto[];
  total: number;
  page: number;
  totalPages: number;

  static fromPaginatedBusinesses(
    result: any,
  ): PaginatedPublicBusinessResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}

// Detail page (brand profile)
export class PublicBusinessDetailDto {
  // identity
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;

  // trust
  verified: boolean;
  badge?: string;
  trustScore?: number;

  // metrics
  rating: { average: number; count: number };
  productCount: number;

  // fulfillment
  deliverySlaMinutes?: number;
  deliverySlaDisplay?: string;
  onTimeRate30d?: number;
  cancelRate30d?: number;

  // audience & growth
  customerCount?: number;
  customerCountDisplay?: string;
  growthRate?: number;
  growthRateDisplay?: string;

  // facets
  specialty?: string[];
  createdAt?: Date;

  static fromBusiness(business: any): PublicBusinessDetailDto {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl:
        business.logo || business.avatar || business.avatarUrl || undefined,
      description: business.description || undefined,
      verified: !!business.verified,
      badge: business.badge || undefined,
      trustScore: business.trustScore ?? undefined,
      rating: {
        average: business.ratingAverage ?? business.rating ?? 0,
        count: business.ratingCount ?? 0,
      },
      productCount: business._count?.products ?? business.productCount ?? 0,
      deliverySlaMinutes: business.deliverySlaMinutes ?? undefined,
      deliverySlaDisplay: business.deliverySlaDisplay ?? undefined,
      onTimeRate30d: business.onTimeRate30d ?? undefined,
      cancelRate30d: business.cancelRate30d ?? undefined,
      customerCount: business.customerCount ?? undefined,
      customerCountDisplay: business.customerCountDisplay ?? undefined,
      growthRate: business.salesGrowth30d ?? business.growthRate ?? undefined,
      growthRateDisplay: business.growthRateDisplay ?? undefined,
      specialty: Array.isArray(business.specialty)
        ? business.specialty
        : business.specialty
          ? [business.specialty]
          : undefined,
      createdAt: business.createdAt,
    };
  }
}
