import {
  KiotVietBaseEntity,
  KiotVietPaymentBase,
} from './kiotviet.common.interface';

/**
 * Interface for order information from KiotViet API
 * Used for endpoint: GET /orders
 */
export interface KiotVietOrderItem extends KiotVietBaseEntity {
  id: number; //
  code: string; //
  purchaseDate: Date; //
  branchId: number; //
  branchName: string; //
  soldById?: number; //
  soldByName: string; //
  customerId?: number; //
  customerCode: string; //
  customerName: string; //
  total: number; //
  totalPayment: number; //
  discountRatio?: number; //
  discount?: number; //
  status: number; // 1. Phiếu tạm, 2. Đang giao hàng, 3. Hoàn thành, 4. Đã hủy, 5. Đã xác nhận
  statusValue: string; //
  usingCod: boolean; //
  payments: KiotVietOrderPaymentItem[]; //
  orderDetails: KiotVietOrderDetailItem[]; //
  orderDelivery: KiotVietOrderDeliveryItem; //
  saleChannelId?: number;
}

/**
 * Interface for order detail item
 */
export interface KiotVietOrderDetailItem {
  productId: number;
  productCode: string;
  productName: string;
  isMaster: boolean;
  quantity: number;
  price: number;
  discount?: number;
  discountRatio?: number;
  note: string;
}

/**
 * Interface for order payment information
 */
export interface KiotVietOrderPaymentItem extends KiotVietPaymentBase {}

/**
 * Interface for order delivery information
 */
export interface KiotVietOrderDeliveryItem {
  deliveryCode: string;
  type?: number;
  price?: number;
  receiver: string;
  contactNumber: string;
  address: string;
  locationId?: number;
  locationName: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  partnerDeliveryId?: number;
  partnerDelivery: KiotVietOrderPartnerDeliveryItem;
}

/**
 * Interface for partner delivery information
 */
export interface KiotVietOrderPartnerDeliveryItem {
  code: string;
  name: string;
  address: string;
  contactNumber: string;
  email: string;
}

/**
 * Interface for order surcharge information
 */
export interface KiotVietOrderSurchargeItem {
  id: number;
  invoiceId?: number;
  surchargeId?: number;
  surchargeName: string;
  surValue?: number;
  price?: number;
  createdDate: Date;
}

/**
 * Interface for full order detail from KiotViet API
 * Used for endpoint: GET /orders/code/{code}
 */
export interface KiotVietOrderDetailFullItem extends KiotVietBaseEntity {
  id: number;
  code: string;
  purchaseDate: Date;
  branchId: number;
  branchName: string;
  soldById?: number;
  soldByName: string;
  customerId?: number;
  customerName: string;
  total: number;
  totalPayment: number;
  discountRatio?: number;
  discount?: number;
  status: number;
  statusValue: string;
  description: string;
  usingCod: boolean;
  payments: KiotVietOrderPaymentItem[];
  orderDetails: KiotVietOrderDetailItem[];
  orderDelivery: KiotVietOrderDeliveryItem;
  invoiceOrderSurcharges: KiotVietOrderSurchargeItem[];
}
