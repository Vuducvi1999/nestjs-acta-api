import {
  KiotVietBaseEntity,
  KiotVietPaymentBase,
} from './kiotviet.common.interface';

/**
 * Interface for return order information from KiotViet API (trả hàng)
 * Used for endpoint: GET /returns
 */
export interface KiotVietReturnOrderItem extends KiotVietBaseEntity {
  id: number; //
  code: string; //
  invoiceId?: number; //
  returnDate: Date; //
  branchId: number; //
  branchName: string; //
  receivedById: number; //
  soldByName: string; //
  customerId?: number; //
  customerCode: string; //
  customerName: string; //
  returnTotal: number; //
  returnDiscount?: number; //
  returnFee?: number; //
  totalPayment: number; //
  status: number; //
  statusValue: string; //
  payments: KiotVietReturnPaymentItem[]; //
  returnDetails: KiotVietReturnDetailItem[];
}

/**
 * Interface for return payment information
 */
export interface KiotVietReturnPaymentItem extends KiotVietPaymentBase {}

/**
 * Interface for return detail item
 */
export interface KiotVietReturnDetailItem {
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  note: string;
  usePoint?: boolean;
  subTotal: number;
}

/**
 * Interface for return order detail from KiotViet API
 * Used for endpoint: GET /returns/{id}
 */
export interface KiotVietReturnOrderDetailItem {
  id: number;
  code: string;
  invoiceId?: number;
  returnDate: Date;
  branchId: number;
  branchName: string;
  receivedById: number;
  soldByName: string;
  customerId?: number;
  customerCode: string;
  customerName: string;
  returnTotal: number;
  returnDiscount?: number;
  returnFee?: number;
  totalPayment: number;
  status: number;
  statusValue: string;
  createdDate: Date;
  modifiedDate: Date;
  payments: KiotVietReturnPaymentItem[];
  returnDetails: KiotVietReturnDetailItem[];
}
