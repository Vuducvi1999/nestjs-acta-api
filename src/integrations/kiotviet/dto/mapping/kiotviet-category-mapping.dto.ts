import { CategoryGroup, OriginSource } from '@prisma/client';
import { KiotVietProductMapping } from './kiotviet-product-mapping.dto';

export class KiotVietCategoryMapping {
  id: string;

  kiotVietCategoryId?: number;
  kiotVietParentId?: number;
  hasChild?: boolean;

  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;

  source: OriginSource;
  group: CategoryGroup;
  isRoot: boolean;

  parentId?: string;
  parentName?: string;
  children: KiotVietCategoryMapping[];

  products: KiotVietProductMapping[];
  featuredProducts: KiotVietProductMapping[];
}
