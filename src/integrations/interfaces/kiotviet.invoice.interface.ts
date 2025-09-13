import {
  KiotVietBaseEntity,
  KiotVietPaymentBase,
} from './kiotviet.common.interface';
import { KiotVietProductBatchExpireItem } from './kiotviet.product.interface';

export enum KiotVietInvoiceDeliveryStatus {
  PENDING = 1, // Chờ xử lý
  DELIVERING = 2, // Đang giao hàng
  DELIVERED = 3, // Giao thành công
  RETURNING = 4, // Đang chuyển hoàn
  RETURNED = 5, // Đã chuyển hoàn
  CANCELLED = 6, // Đã hủy
  PICKING_UP = 7, // Đang lấy hàng
  WAITING_PICKUP = 8, // Chờ lấy lại
  PICKED_UP = 9, // Đã lấy hàng
  WAITING_REDELIVERY = 10, // Chờ giao lại
  WAITING_TRANSFER = 11, // Chờ chuyển hàng
  WAITING_RETURN_TRANSFER = 12, // Chờ chuyển hoàn lại
}

/**
 * Interface for invoice information from KiotViet API
 * Used for endpoint: GET /invoices
 */
export interface KiotVietInvoiceItem extends KiotVietBaseEntity {
  id: number; //
  code: string; //
  uuid: string; //
  purchaseDate: Date; //
  branchId: number; //
  branchName: string; //
  soldById?: number; //
  soldByName: string; //
  customerId?: number; //
  customerCode: string; //
  customerName: string; //
  orderCode: string; //
  total: number; //
  totalPayment: number; //
  status: number; //
  statusValue: string; //
  usingCod: boolean; //
  payments: KiotVietInvoicePaymentItem[]; //
  invoiceOrderSurcharges: KiotVietInvoiceSurchargeItem[]; //
  invoiceDetails: KiotVietInvoiceDetailItem[]; //
  SaleChannel: KiotVietSaleChannelItem;
  invoiceDelivery: KiotVietInvoiceDeliveryItem; //
}

/**
 * Interface for invoice detail item
 */
export interface KiotVietInvoiceDetailItem {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  categoryId: number;
  categoryName: string;
  price: number;
  discount: number;
  subTotal: number;
  note: string;
  serialNumbers: string;
  returnQuantity: number;
  productBatchExpire: KiotVietProductBatchExpireItem;
}

/**
 * Interface for invoice payment information
 */
export interface KiotVietInvoicePaymentItem extends KiotVietPaymentBase {}

/**
 * Interface for invoice surcharge information
 */
export interface KiotVietInvoiceSurchargeItem {
  id: number;
  invoiceId?: number;
  surchargeId?: number;
  surchargeName: string;
  surValue?: number;
  price?: number;
  createdDate: Date;
}

/**
 * Interface for invoice delivery information
 */
export interface KiotVietInvoiceDeliveryItem {
  deliveryCode: string;
  type?: number;
  status: KiotVietInvoiceDeliveryStatus;
  statusValue: string;
  price?: number;
  receiver: string;
  contactNumber: string;
  address: string;
  locationId?: number;
  locationName: string;
  usingPriceCod: boolean;
  priceCodPayment: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  partnerDeliveryId?: number;
  partnerDelivery: KiotVietInvoicePartnerDeliveryItem;
}

/**
 * Interface for invoice partner delivery information
 */
export interface KiotVietInvoicePartnerDeliveryItem {
  code: string;
  name: string;
  address: string;
  contactNumber: string;
  email: string;
}

/**
 * Interface for sale channel information
 */
export interface KiotVietSaleChannelItem {
  IsNotDelete: boolean;
  RetailerId: number;
  Position: number;
  IsActivate: boolean;
  CreatedBy: number;
  CreatedDate: Date;
  Id: number;
  Name: string;
}

/**
 * Interface for full invoice detail from KiotViet API
 * Used for endpoint: GET /invoices/{id}
 */
export interface KiotVietInvoiceDetailFullItem extends KiotVietBaseEntity {
  id: number;
  code: string;
  orderCode: string;
  purchaseDate: Date;
  branchId: number;
  branchName: string;
  soldById?: number;
  soldByName: string;
  customerId?: number;
  customerCode: string;
  customerName: string;
  total: number;
  totalPayment: number;
  status: number;
  statusValue: string;
  description: string;
  usingCod: boolean;
  payments: KiotVietInvoicePaymentItem[];
  invoiceOrderSurcharges: KiotVietInvoiceSurchargeItem[];
  invoiceDetails: KiotVietInvoiceDetailItem[];
  SaleChannel: KiotVietSaleChannelItem;
  invoiceDelivery: KiotVietInvoiceDeliveryItem;
}
