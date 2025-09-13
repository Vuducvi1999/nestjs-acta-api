import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for category information from KiotViet API
 * Used for endpoint: GET /categories
 */
export interface KiotVietCategoryItem extends KiotVietBaseEntity {
  categoryId: number;
  parentId?: number;
  categoryName: string;
  hasChild?: boolean;
  children: KiotVietCategoryItem[];
  rank: number;
}

/**
 * Interface for category detail from KiotViet API
 * Used for endpoint: GET /categories/{id}
 */
export interface KiotVietCategoryDetailItem extends KiotVietBaseEntity {
  categoryId: number;
  parentId?: number;
  categoryName: string;
  hasChild?: boolean;
  children: KiotVietCategoryItem[];
}
