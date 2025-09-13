import { InvoiceStatus, OriginSource } from "@prisma/client";
import { KiotVietPaymentMapping } from "./kiotviet-payment-mapping.dto";

export class KiotVietInvoiceMapping {
  id: string;
  code: string;

  kiotVietInvoiceId?: number;
  kiotVietUuid?: string;
  kiotVietWarehouseId?: number;
  kiotVietCustomerId?: number;
  kiotVietSoldById?: number;
  kiotVietOrderCode?: string;

  purchaseDate: Date;
  status: InvoiceStatus;
  usingCod: boolean;
  source: OriginSource;

  payments: KiotVietPaymentMapping[];
}

export class KiotVietInvoiceDetailMapping {
  id: string;

  kiotVietInvoiceId: number;
  kiotVietInvoiceDetailId: number;
  kiotVietProductId: number;
  kiotVietCategoryId: number;
  kiotVietBatchExpireId: number;

  quantity: number;
  discount: number;
  note: string;
  serialNumbers: string;
  returnQuantity: number;
  source: OriginSource;

  productBatchExpireId: string;
  productBatchExpireName: string;

  invoiceId: string;
}