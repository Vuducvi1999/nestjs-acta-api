/* ------------------------------------------------------------
 * Query DTO for categories
 * - Supports text search, parent filtering, group filters,
 *   root/active toggles, sort & pagination
 * - Mirrors style of PublicProductQueryDto
 * ------------------------------------------------------------ */

import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoryGroup } from '@prisma/client';

export type Breadcrumb = {
  id: string;
  name: string;
  slug: string;
};

export class PublicCategoryQueryDto {
  @IsOptional()
  @IsString()
  q?: string; // search by name/slug/description

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  isRoot?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    return [];
  })
  group?: CategoryGroup[];

  @IsOptional()
  @IsString()
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock'; // optional proxy filter via product join

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  page?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  pageSize?: number;

  @IsOptional()
  @IsEnum(['name', 'createdAt', 'updatedAt', 'productCount'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'productCount';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}

/* ------------------------------------------------------------
 * Utility: compact payload for “related categories” section
 * ------------------------------------------------------------ */

export class PublicRelatedCategoryDto {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
  productCount?: number;

  static fromCategory(category: any): PublicRelatedCategoryDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image ?? null,
      productCount:
        category._count?.products ?? category.productCount ?? undefined,
    };
  }
}

/* ------------------------------------------------------------
 * Menu/Search suggestions payload
 * - Used for header search autosuggest (categories only)
 * ------------------------------------------------------------ */

export class PublicCategorySuggestDto {
  id: string;
  name: string;
  slug: string;
  path: string[]; // e.g., ["Đồ uống", "Nước ép", "Anh đào"]
  icon?: string | null;

  static fromCategory(category: any): PublicCategorySuggestDto {
    const chain: Breadcrumb[] = Array.isArray(category.parentChain)
      ? category.parentChain
      : [];
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      path: [...chain.map((b) => b.name), category.name],
      icon: category.icon ?? null,
    };
  }
}
