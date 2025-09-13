import { OriginSource, PriceBookType } from '@prisma/client';
import { KiotVietProductMapping } from './kiotviet-product-mapping.dto';
import { KiotVietWarehouseMapping } from './kiotviet-warehouse-mapping.dto';
import { KiotVietCustomerGroupMapping } from './kiotviet-customer-mapping.dto';
import { KiotVietUserMapping } from './kiotviet-user-mapping.dto';

export class KiotVietPricebookMapping {
  id: string;

  kiotVietPricebookId?: number;

  name: string;
  description?: string;
  price: number;
  type: PriceBookType;
  isActive: boolean;
  isGlobal: boolean;
  startDate?: Date;
  endDate?: Date;
  forAllCusGroup: boolean;
  forAllWarehouse: boolean;
  forAllUser: boolean;
  source: OriginSource;

  products: KiotVietProductMapping[];
  warehouses: KiotVietWarehouseMapping[];
  customerGroups: KiotVietCustomerGroupMapping[];
  users: KiotVietUserMapping[];

  createdAt: Date;
  updatedAt: Date;
}
