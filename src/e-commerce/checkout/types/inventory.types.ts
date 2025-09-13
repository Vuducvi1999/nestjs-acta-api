import { Prisma, OriginSource } from '@prisma/client';

// Cart item types
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product?: {
    id: string;
    name: string;
    price: number;
    basePrice: number;
    minQuantity: number;
    maxQuantity?: number | null;
    businessId?: string | null;
  };
}

// Product with inventory type
export interface ProductWithInventory {
  id: string;
  name: string;
  price: Prisma.Decimal;
  basePrice: Prisma.Decimal;
  minQuantity: number;
  maxQuantity?: number | null;
  businessId?: string | null;
  inventories: Array<{
    id: string;
    productId: string;
    warehouseId: string;
    cost: Prisma.Decimal;
    onHand: number;
    onOrder: number;
    reserved: number;
    actualReserved: number;
    minQuantity: number;
    maxQuantity?: number | null;
    source: OriginSource;
  }>;
}

// Order detail with order type
export interface OrderDetailWithOrder {
  id: string;
  productId: string;
  quantity: number;
  order: {
    id: string;
    warehouseId: string;
  };
}

// Inventory record type
export interface InventoryRecord {
  id: string;
  productId: string;
  warehouseId: string;
  cost: Prisma.Decimal;
  onHand: number;
  onOrder: number;
  reserved: number;
  actualReserved: number;
  minQuantity: number;
  maxQuantity?: number | null;
  source: string;
}

// Transaction type
export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

// Inventory update data type
export interface InventoryUpdateData {
  reserved?: { increment: number } | { decrement: number };
  actualReserved?: { increment: number } | { decrement: number };
  onHand?: { increment: number } | { decrement: number };
  onOrder?: { increment: number } | { decrement: number };
}

// Warehouse type
export interface Warehouse {
  id: string;
  name: string;
  isActive: boolean;
}

// Product type for inventory creation
export interface ProductForInventory {
  id: string;
  basePrice: number;
  minQuantity: number;
  maxQuantity?: number | null;
}
