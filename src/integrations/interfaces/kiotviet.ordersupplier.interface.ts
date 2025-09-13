import { KiotVietBaseEntity } from './kiotviet.common.interface';

/**
 * Interface for order supplier information from KiotViet API
 * Used for endpoint: GET /ordersuppliers
 */
export interface KiotVietOrderSupplierItem extends KiotVietBaseEntity {
  id: number; //
  code: string; //
  invoiceId?: number; //
  orderDate: Date; //
  branchId: number; //
  userId: number; //
  description: string; //
  status: number; //
  discountRatio?: number; //
  productQty?: number; //
  discount?: number; //
  createdBy: number; //
  orderSupplierDetails: KiotVietOrderSupplierDetailItem[];
  OrderSupplierExpensesOthers: KiotVietOrderSupplierExpenseItem[];
  total: number; //
  exReturnSuppliers?: number; //
  exReturnThirdParty?: number; //
  totalAmt?: number; //
  totalQty?: number; //
  totalQuantity: number; //
  subTotal: number; //
  paidAmount: number; //
  toComplete: boolean; //
  statusValue: string; //
  viewPrice: boolean; //
  supplierDebt: number; //
  supplierOldDebt: number; //
  purchaseOrderCodes: string; //
}

/**
 * Interface for order supplier detail item
 */
export interface KiotVietOrderSupplierDetailItem extends KiotVietBaseEntity {
  id: number; 
  orderSupplierId: number;
  productId: number;
  quantity: number;
  price: number;
  discount: number;
  allocation: number;
  description: string;
  orderByNumber?: number;
  allocationSuppliers?: number;
  allocationThirdParty?: number;
  orderQuantity: number;
  subTotal: number;
}

/**
 * Interface for order supplier expense item
 */
export interface KiotVietOrderSupplierExpenseItem extends KiotVietBaseEntity {
  id: number;
  form?: number;
  expensesOtherOrder?: number;
  expensesOtherCode: string;
  expensesOtherName: string;
  expensesOtherId: number;
  orderSupplierId?: number;
  price: number;
  isReturnAuto?: boolean;
  exValue?: number;
}
