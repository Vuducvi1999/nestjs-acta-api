import { CommissionLevel, CommissionStatus } from '@prisma/client';

// Enums for better type safety
export enum CategoryGroup {
  A = 'a',
  B = 'b',
  C = 'c',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum CalculationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

// Commission rate constants
export const COMMISSION_RATES = {
  CATEGORY: {
    [CategoryGroup.A]: 0.2, // 20%
    [CategoryGroup.B]: 0.3, // 30%
    [CategoryGroup.C]: 0.5, // 50%
  },
  LEVEL: {
    [CommissionLevel.F0]: 0.2, // 20% for F0
    [CommissionLevel.F1]: 0.3, // 30% for F1
    [CommissionLevel.F2]: 1.0, // 100% for F2 (customer gets full commission for their category)
  },
  DEFAULT: 0.2, // 20% default
} as const;

// Base interfaces
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Beneficiary {
  id: string;
  fullName: string;
  email: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
}

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  placedAt?: Date;
}

export interface OrderDetail {
  quantity: number;
  price: number;
  discount?: number;
}

export interface OrderItem {
  orderId: string;
  code: string;
  placedAt?: Date;
  amount: number;
}

// Commission-specific interfaces
export interface CommissionSummary {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  totalSales: number;
  byLevel: Partial<Record<CommissionLevel, number>>;
  salesByLevel?: Partial<Record<CommissionLevel, number>>;
  ordersByLevel?: Partial<Record<CommissionLevel, any[]>>;
}

export interface CommissionCalculationResult {
  success: boolean;
  message: string;
  totalCommissions: number;
  totalAmount: number;
  errors?: string[];
}

export interface CommissionStats {
  status: CommissionStatus;
  _sum: {
    commissionAmount: number | null;
  };
}

export interface CommissionLevelStats {
  commissionLevel: CommissionLevel;
  _sum: {
    commissionAmount: number | null;
  };
}

export interface SalesData {
  commissionLevel: CommissionLevel;
  quantity: number;
  product: {
    price: number;
  };
}

// Database query interfaces
export interface CommissionWhereClause {
  orderId?: string;
  productId?: string;
  beneficiaryId?: string;
  commissionLevel?: CommissionLevel;
  status?: CommissionStatus;
  categoryId?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

export interface CommissionInclude {
  beneficiary: {
    select: {
      id: true;
      fullName: true;
      email: true;
    };
  };
  product: {
    select: {
      id: true;
      name: true;
      price: true;
    };
  };
  category: {
    select: {
      id: true;
      name: true;
      group: true;
    };
  };
  order: {
    select: {
      id: true;
      code: true;
      status: true;
      placedAt?: true;
    };
  };
}

// Service method return types
export interface PaginatedCommissionResponse {
  data: any[]; // Will be properly typed with the DTO
  total: number;
  page?: number;
  limit?: number;
}

export interface UserCommissionResponse {
  data: any[]; // Will be properly typed with the DTO
  total: number;
  summary: CommissionSummary;
}

// Log interfaces
export interface CommissionLogData {
  orderId: string;
  totalCommissionAmount: number;
  commissionCount: number;
  calculationStatus: CalculationStatus;
  processedBy: string;
  notes?: string;
}

// Commission creation interface
export interface CommissionCreateData {
  orderId: string;
  orderDetailId?: string;
  productId: string;
  beneficiaryId: string;
  commissionLevel: CommissionLevel;
  commissionRate: number;
  baseAmount: number;
  quantity: number;
  commissionAmount: number;
  categoryId: string;
  status: CommissionStatus;
}

// Enhanced query options
export interface QueryOptions {
  page?: number;
  limit?: number;
  includeOrders?: boolean;
  orderLimit?: number;
  startDate?: string | Date;
  endDate?: string | Date;
}

// Type guards
export const isCategoryGroup = (value: string): value is CategoryGroup => {
  return Object.values(CategoryGroup).includes(value as CategoryGroup);
};

export const isOrderStatus = (value: string): value is OrderStatus => {
  return Object.values(OrderStatus).includes(value as OrderStatus);
};

export const isCommissionLevel = (value: string): value is CommissionLevel => {
  return Object.values(CommissionLevel).includes(value as CommissionLevel);
};

export const isCommissionStatus = (
  value: string,
): value is CommissionStatus => {
  return Object.values(CommissionStatus).includes(value as CommissionStatus);
};
