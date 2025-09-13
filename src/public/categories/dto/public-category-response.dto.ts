import { CategoryGroup } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/* ------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------ */

export const CategoryGroupPercent: Record<CategoryGroup, number> = {
  a: 20,
  b: 30,
  c: 50,
} as const;

type Breadcrumb = { id: string; name: string; slug: string };

/* ------------------------------------------------------------
 * Lightweight “Item” for listings / cards
 * ------------------------------------------------------------ */

export class PublicCategoryItemDto {
  id: string;

  name: string;
  slug: string;

  description?: string;
  image?: string | null;
  icon?: string | null;
  color?: string | null;

  group: CategoryGroup;
  groupPercent: number;

  isRoot: boolean;
  hasChild?: boolean;

  productCount: number;
  activeProductCount?: number;

  parent?: { id: string; name: string; slug: string } | null;

  createdAt?: Date;
  updatedAt?: Date;

  static fromCategory(category: any): PublicCategoryItemDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? undefined,
      image: category.image ?? null,
      icon: category.icon ?? null,
      color: category.color ?? null,
      group: category.group,
      groupPercent: CategoryGroupPercent[category.group as CategoryGroup],
      isRoot: !!category.isRoot,
      hasChild:
        typeof category.hasChild === 'boolean'
          ? category.hasChild
          : Array.isArray(category.children) && category.children.length > 0,
      productCount: category._count?.products ?? category.productCount ?? 0,
      activeProductCount: category.activeProductCount ?? undefined,
      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
          }
        : category.parentId
          ? {
              id: category.parentId,
              name: category.parentName,
              slug: category.parentSlug,
            }
          : null,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}

/* ------------------------------------------------------------
 * Tree/Menu node (recursive)
 * - Optimized payload for sidebars, mega menus, mobile sheets
 * ------------------------------------------------------------ */

export class PublicCategoryMenuNodeDto {
  id: string;
  name: string;
  slug: string;

  group: CategoryGroup;
  groupPercent: number;

  image?: string | null;
  color?: string | null;
  icon?: string | null;

  productCount?: number;
  childCount?: number;

  children: PublicCategoryMenuNodeDto[];

  static fromCategory(
    category: any,
    opts?: { withCounts?: boolean },
  ): PublicCategoryMenuNodeDto {
    const childrenRaw: any[] = Array.isArray(category.children)
      ? category.children
      : [];
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      group: category.group,
      groupPercent: CategoryGroupPercent[category.group as CategoryGroup],
      image: category.image ?? null,
      color: category.color ?? null,
      icon: category.icon ?? null,
      productCount: opts?.withCounts
        ? (category._count?.products ?? category.productCount ?? undefined)
        : undefined,
      childCount: opts?.withCounts ? childrenRaw.length : undefined,
      children: childrenRaw.map((c) =>
        PublicCategoryMenuNodeDto.fromCategory(c, opts),
      ),
    };
  }
}

/* ------------------------------------------------------------
 * Category detail for category landing page (Shopify-like)
 * - Includes breadcrumbs, siblings, children, and optional SEO
 * - “featuredProducts” kept lightweight for hero/section usage
 * ------------------------------------------------------------ */

export class PublicCategoryDetailDto {
  id: string;
  name: string;
  slug: string;

  description?: string;
  image?: string | null;
  bannerImage?: string | null; // optional hero banner if you store it
  color?: string | null;
  icon?: string | null;

  group: CategoryGroup;
  groupPercent: number;
  isRoot: boolean;

  breadcrumbs: Breadcrumb[];
  parent?: { id: string; name: string; slug: string } | null;

  // navigation helpers
  children: Array<{
    id: string;
    name: string;
    slug: string;
    image?: string | null;
    productCount?: number;
  }>;
  siblings?: Array<{ id: string; name: string; slug: string }>;

  // stats
  productCount: number;
  activeProductCount?: number;

  // marketing / SEO
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
    structuredData?: any;
  };

  // spotlight content
  featuredProducts?: Array<{
    id: string;
    name: string;
    slug: string;
    thumbnail: string;
    price: number;
    basePrice: number;
    hasVariants: boolean;
    priceMin?: number;
    priceMax?: number;
    rating?: { average: number; count: number };
    badges?: string[];
  }>;

  updatedAt?: string; // ISO for ISR/cache headers

  static fromCategory(category: any): PublicCategoryDetailDto {
    const childrenRaw: any[] = Array.isArray(category.children)
      ? category.children
      : [];

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? undefined,
      image: category.image ?? null,
      bannerImage: category.bannerImage ?? null,
      color: category.color ?? null,
      icon: category.icon ?? null,
      group: category.group,
      groupPercent: CategoryGroupPercent[category.group as CategoryGroup],
      isRoot: !!category.isRoot,

      breadcrumbs:
        category.parentChain && Array.isArray(category.parentChain)
          ? category.parentChain.map((b: any) => ({
              id: b.id,
              name: b.name,
              slug: b.slug,
            }))
          : [],

      parent: category.parent
        ? {
            id: category.parent.id,
            name: category.parent.name,
            slug: category.parent.slug,
          }
        : category.parentId
          ? {
              id: category.parentId,
              name: category.parentName,
              slug: category.parentSlug,
            }
          : null,

      children: childrenRaw.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image: c.image ?? null,
        productCount: c._count?.products ?? c.productCount ?? undefined,
      })),

      siblings: Array.isArray(category.siblings)
        ? category.siblings.map((s: any) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
          }))
        : undefined,

      productCount: category._count?.products ?? category.productCount ?? 0,
      activeProductCount: category.activeProductCount ?? undefined,

      seo: category.seo
        ? {
            metaTitle: category.seo?.metaTitle,
            metaDescription: category.seo?.metaDescription,
            keywords: category.seo?.keywords,
            canonicalUrl: category.seo?.canonicalUrl,
            structuredData: category.seo?.structuredData,
          }
        : undefined,

      featuredProducts: Array.isArray(category.featuredProducts)
        ? category.featuredProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            thumbnail: p.thumbnail,
            price: p.price,
            basePrice: p.basePrice,
            hasVariants: !!p.hasVariants,
            priceMin: p.priceMin,
            priceMax: p.priceMax,
            rating: p.rating
              ? { average: p.rating.average ?? 0, count: p.rating.count ?? 0 }
              : undefined,
            badges: p.badges ?? undefined,
          }))
        : undefined,

      updatedAt: category.updatedAt
        ? new Date(category.updatedAt).toISOString()
        : undefined,
    };
  }
}

/* ------------------------------------------------------------
 * Paginated response for category listings
 * ------------------------------------------------------------ */

export class PaginatedPublicCategoryResponseDto {
  data: PublicCategoryItemDto[];
  total: number;
  page: number;
  totalPages: number;

  static fromPaginated(result: {
    data: any[];
    total: number;
    page: number;
    totalPages: number;
  }): PaginatedPublicCategoryResponseDto {
    return {
      data: (result.data ?? []).map((c) =>
        PublicCategoryItemDto.fromCategory(c),
      ),
      total: result.total ?? 0,
      page: result.page ?? 1,
      totalPages: result.totalPages ?? 1,
    };
  }
}

/* ------------------------------------------------------------
 * “Tree” payload for client menus (e.g., sidebar/mega/menu API)
 * ------------------------------------------------------------ */

export class PublicCategoryTreeDto {
  root: PublicCategoryMenuNodeDto[];

  static fromCategories(
    categories: any[],
    opts?: { withCounts?: boolean },
  ): PublicCategoryTreeDto {
    return {
      root: (categories ?? []).map((c) =>
        PublicCategoryMenuNodeDto.fromCategory(c, opts),
      ),
    };
  }
}
