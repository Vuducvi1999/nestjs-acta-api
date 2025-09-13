import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for product information from KiotViet API
 * Used for endpoint: GET /products
 */
export interface KiotVietProductItem extends KiotVietBaseEntity {
  id: number;
  code: string;

  // Thông tin về sản phẩm
  name: string; //
  barCode: string; //
  allowsSale: boolean; //
  categoryId: number; //
  categoryName: string; //
  tradeMarkId: number; //
  tradeMarkName: string; //
  fullName: string; //
  type: number; //
  description: string; //
  hasVariants?: boolean; //
  attributes: KiotVietProductAttributeItem[]; //
  unit: string; //
  masterUnitId: number; //
  masterProductId?: number; //
  conversionValue?: number; //
  units: KiotVietProductUnitItem[]; //
  images: string[]; //
  inventories: KiotVietProductInventoryItem[]; //
  priceBooks: KiotVietProductPriceBookItem[]; //
  productFormulas: KiotVietProductFormulaItem[]; //
  serials: KiotVietProductSerial[]; //
  productBatchExpires: KiotVietProductBatchExpireItem[]; //
  productWarranties: KiotVietProductWarrantyItem[]; //
  basePrice?: number; //
  weight?: number; //
  orderTemplate: string; //
  minQuantity: number; //
  maxQuantity: number; //
  productShelves: KiotVietProductShelfItem[]; //
  taxType: string; //
  taxRate: string; //
  taxRateDirect?: number;
  isActive: boolean; //
  isLotSerialControl?: boolean; //
  isBatchExpireControl?: boolean; //
  taxname: string; //
  isRewardPoint?: boolean; //
}

/**
 * Interface for product batch/expire information
 */
export interface KiotVietProductBatchExpireItem {
  id: number;
  productId: number;
  onHand: number;
  batchName: string;
  expireDate: Date;
  fullNameVirgule: string;
  createdDate: Date;
  branchId: number;
}

/**
 * Interface for trademark information from KiotViet API
 * Used for endpoint: GET /trademarks
 */
export interface KiotVietTradeMarkItem {
  tradeMarkId: number;
  tradeMarkName: string;
  createdDate: Date;
  modifiedDate: Date;
}

export interface KiotVietProductAttributeItem {
  productId: number;
  attributeName: string;
  attributeValue: string;
}

export interface KiotVietProductUnitItem {
  id: number;
  code: string;
  name: string;
  fullName: string;
  unit: string;
  conversionValue: number;
  basePrice: number;
}

export interface KiotVietProductInventoryItem {
  productId: number;
  productCode: string;
  productName: string;
  branchId: number;
  branchName: string;
  onHand?: number;
  cost?: number;
  onOrder: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface KiotVietProductPriceBookItem {
  priceBookId: number;
  priceBookName: string;
  productId: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  price: number;
}

export interface KiotVietProductFormulaItem {
  materialId: number;
  materialCode: string;
  materialFullName: string;
  materialName: string;
  quantity: number;
  basePrice: number;
  productId?: number;
  product: KiotVietProductFormulaProductItem;
}

export interface KiotVietProductFormulaProductItem extends KiotVietBaseEntity {
  id: number;
  code: string;
  name?: string;
  fullName?: Date;
  categoryId: number;
  allowsSale: boolean;
  hasVariants?: boolean;
  basePrice: number;
  unit: string;
  conversionValue?: number;
  isActive: boolean;
  isRewardPoint?: boolean;
  orderTemplate: string;
  isLotSerialControl?: boolean;
  isBatchExpireControl?: boolean;
}

export interface KiotVietProductSerial {
  productId: number;
  serialNumber: string;
  status: number;
  branchId: number;
  quantity?: number;
  createdDate: Date;
  modifiedDate?: Date;
}

export interface KiotVietProductWarrantyItem extends KiotVietBaseEntity {
  id: number;
  description: string;
  numberTime: number;
  timeType: number;
  warrantyType: number;
  productId: number;
  createdBy?: number;
}

export interface KiotVietProductShelfItem {
  branchId: number;
  branchName: string;
  ProductShelves: string;
}
