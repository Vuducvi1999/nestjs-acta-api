// cart-item-query.dto.ts
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator';

/**
 * Query DTO for filtering & paginating cart items
 * Mirrors the style of PublicProductQueryDto
 */
export class CartItemQueryDto {
  // ---- Ownership / scoping ----
  @IsOptional()
  @IsString()
  cartId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  // ---- Search (free text) ----
  // Search by product name/code/sku (your service can apply to multiple fields)
  @IsOptional()
  @IsString()
  q?: string;

  // ---- Product filters ----
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  // Multiple category groups if you support it at cart view level
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') return value.split(',');
    return Array.isArray(value) ? value : [];
  })
  categoryGroup?: string[];

  // SKU filter for variant-specific items (if stored on CartItem)
  @IsOptional()
  @IsString()
  sku?: string;

  // ---- Quantity & price range ----
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  minQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  maxQuantity?: number;

  // Filter by unit price (product price at the time of query)
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  maxPrice?: number;

  // Filter by computed subtotal (price * quantity)
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  minSubtotal?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  maxSubtotal?: number;

  // ---- Availability / marketing flags (from product snapshot) ----
  @IsOptional()
  @IsString()
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  freeShipping?: boolean;

  // Include items whose product is currently unavailable (OOS, discontinued) or not
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    typeof value === 'string' ? value === 'true' : value,
  )
  includeUnavailable?: boolean;

  // ---- Date ranges ----
  // ISO strings recommended; transform to Date if you prefer in service layer
  @IsOptional()
  @IsString()
  createdFrom?: string; // e.g. '2025-08-01T00:00:00.000Z'

  @IsOptional()
  @IsString()
  createdTo?: string;

  @IsOptional()
  @IsString()
  updatedFrom?: string;

  @IsOptional()
  @IsString()
  updatedTo?: string;

  // ---- Pagination ----
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

  // ---- Sorting ----
  // name/price derived from product; quantity/subtotal from cart item; createdAt for item add time
  @IsOptional()
  @IsEnum(['name', 'price', 'quantity', 'subtotal', 'createdAt', 'updatedAt'])
  sortBy?:
    | 'name'
    | 'price'
    | 'quantity'
    | 'subtotal'
    | 'createdAt'
    | 'updatedAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
