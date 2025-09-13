import { OrderStatus, OriginSource } from "@prisma/client";
import { KiotVietPaymentMapping } from "./kiotviet-payment-mapping.dto";
import { KiotVietWarehouseMapping } from "./kiotviet-warehouse-mapping.dto";
import { KiotVietCustomerMapping } from "./kiotviet-customer-mapping.dto";

export class KiotVietOrderMapping {
  id: string;
  code: string;

  kiotVietOrderId?: number;
  kiotVietOrderCode?: string;
  kiotVietWarehouseId?: number;
  kiotVietCustomerId?: number;
  kiotVietSoldById?: number;
  kiotVietSaleChannelId?: number;

  purchaseDate: Date;
  description?: string;
  source: OriginSource;

  status: OrderStatus;
  usingCod: boolean;

  payments: KiotVietPaymentMapping[];

  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;

  customerNote?: string;
  adminNote?: string;

  warehouse: KiotVietWarehouseMapping;

  discountRatio?: number;
  discount?: number;

  customer: KiotVietCustomerMapping;

  createdAt: Date;
  updatedAt: Date;
}