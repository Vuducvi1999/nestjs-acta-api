import { CommissionLevel, CommissionStatus } from '@prisma/client';
import {
  BaseEntity,
  Beneficiary,
  Product,
  Category,
  Order,
  OrderDetail,
  OrderStatus,
} from '../types/commission.types';

export class AffiliateCommissionResponseDto implements BaseEntity {
  id: string;
  orderId: string;
  productId: string;
  beneficiaryId: string;
  commissionLevel: CommissionLevel;
  commissionRate: number;
  baseAmount: number;
  quantity: number;
  commissionAmount: number;
  categoryId: string;
  status: CommissionStatus;
  paidAt?: Date;
  paidBy?: string;
  notes?: string;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Related data with proper typing
  beneficiary?: Beneficiary;
  product?: Product;
  category?: Category;
  order?: Omit<Order, 'status'> & { status: OrderStatus | string };
  orderDetail?: OrderDetail;
}
