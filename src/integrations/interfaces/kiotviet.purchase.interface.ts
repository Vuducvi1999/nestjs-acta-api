import {
  KiotVietBaseEntity,
  KiotVietPaymentBase,
} from './kiotviet.common.interface';
import { KiotVietProductBatchExpireItem } from './kiotviet.product.interface';

/**
 * Interface for purchase order information from KiotViet API (nhập hàng)
 * Used for endpoint: GET /purchaseorders
 */
export interface KiotVietPurchaseOrderItem extends KiotVietBaseEntity {
  id: number; //
  code: string; //
  branchId: number; //
  branchName: string; //
  description: string; //
  purchaseDate: Date; //
  discount?: number; //
  discountRatio?: number; //
  total: number; //
  totalPayment: number; //
  supplierName: string; //
  supplierCode: string; //
  partnerType: string; // Unknown
  status: number; //
  purchaseById?: number; //
  purchaseName: string; //
  purchaseOrderDetails: KiotVietPurchaseOrderDetailItem[]; //
  exReturnSuppliers?: number; //
  exReturnThirdParty?: number; //
  payments: KiotVietPurchaseOrderPaymentItem[]; //
}

/**
 * Interface for purchase order detail item
 */
export interface KiotVietPurchaseOrderDetailItem {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  serialNumber: string;
  productBatchExpire: KiotVietProductBatchExpireItem;
}

/**
 * Interface for purchase order payment information
 */
export interface KiotVietPurchaseOrderPaymentItem extends KiotVietPaymentBase {}
