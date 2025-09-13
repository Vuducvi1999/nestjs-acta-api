import {
  Prisma,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentProcessingStatus,
  OriginSource,
  Role,
  PrismaClient,
} from '@prisma/client';
import { CreateOrderFromCartDto } from '../dto/create-order-from-cart.dto';
import {
  OrderResponseDto,
  PublicOrderDetailResponseDto,
} from '../dto/order-response.dto';
import { CartItemResponseDto } from '../../../public/carts/dto/public-cart-response.dto';

// Prisma transaction type
export type PrismaTransaction = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

// User type for checkout operations
export interface CheckoutUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: Role;
  avatar?: {
    fileUrl: string;
  };
}

// Customer type
export interface Customer {
  id: string;
  userId: string;
  kiotVietCustomerCode: string;
  customerGroupId: string;
  source: OriginSource;
  rewardPoint: number;
  customerGroup: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    fullName: string;
    email: string;
    phoneNumber?: string;
    avatar?: {
      fileUrl: string;
    };
  };
}

// Sale Channel type
export interface SaleChannel {
  id: string;
  name: string;
  isActive: boolean;
  source: OriginSource;
}

// Warehouse type
export interface Warehouse {
  id: string;
  name: string;
  isActive: boolean;
  address?: {
    city?: string;
    state?: string;
  };
}

// Bank Account type
export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  description: string;
}

// Business type
export interface Business {
  id: string;
  name: string;
  isActive: boolean;
}

// Product with full details type
export interface ProductWithDetails {
  id: string;
  name: string;
  price: Prisma.Decimal;
  basePrice: Prisma.Decimal;
  minQuantity: number;
  maxQuantity?: number | null;
  businessId: string;
  isActive: boolean;
  allowsSale: boolean;
  category: {
    id: string;
    name: string;
  };
  business: {
    id: string;
    name: string;
  };
  images: Array<{
    id: string;
    url: string;
    sortOrder: number;
    isMain: boolean;
  }>;
}

// Product Inventory type
export interface ProductInventory {
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
}

// Cart item with inventory type
export interface CartItemWithInventory {
  cartItemId: string;
  quantity: number;
  subtotal: number;
  product: ProductWithDetails;
  inventory: ProductInventory;
  unitPrice: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

// Order totals type
export interface OrderTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

// Order with full relations type
export interface OrderWithRelations {
  id: string;
  code: string;
  clientRequestId?: string;
  purchaseDate: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  usingCod: boolean;
  subtotal: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  customerNote?: string;
  adminNote?: string;
  warehouseId: string;
  customerId: string;
  saleChannelId?: string;
  source: OriginSource;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  customer: Customer;
  warehouse: Warehouse;
  saleChannel?: SaleChannel;
  orderDetails: Array<{
    id: string;
    quantity: number;
    discount: Prisma.Decimal;
    soldById: string;
    productId: string;
    product: ProductWithDetails;
  }>;
  payments: Array<{
    id: string;
    code: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: Prisma.Decimal;
    transDate: Date;
    bankAccount: string;
    description?: string;
    expiresAt?: Date;
    accountId?: string;
  }>;
  orderDelivery?: {
    id: string;
    code: string;
    type: number;
    price: Prisma.Decimal;
    receiver: string;
    contactNumber: string;
    address: string;
  };
}

// Payment info type
export interface PaymentInfo {
  paymentId: string;
  provider: PaymentProvider;
  status: string;
  amount: number;
}

// Order creation result type
export interface OrderCreationResult {
  order: OrderWithRelations;
  totals: OrderTotals;
}

// Inventory validation result type
export interface InventoryValidationResult {
  isValid: boolean;
  errors: string[];
  itemsWithInventory: CartItemWithInventory[];
}

// Checkout helper method signatures
export interface CheckoutHelperInterface {
  generateOrderCode(warehouseId?: string, tx?: any): Promise<string>;
  getOrCreateCustomer(
    user: CheckoutUser,
    tx: PrismaTransaction,
  ): Promise<Customer>;
  getDefaultSaleChannel(tx: PrismaTransaction): Promise<SaleChannel>;
  getDefaultWarehouse(tx: PrismaTransaction): Promise<Warehouse>;
  getBankAccountForTransfer(provider?: string): Promise<BankAccount | null>;
  expiresAtFromConfig(): Date;
  handleError(error: unknown, operation: string, logger?: any): never;
}

// Cart service interface
export interface CartServiceInterface {
  getCart(userId: string): Promise<{ items: CartItemResponseDto[] } | null>;
  clearCart(userId: string): Promise<void>;
}

// Payment service interface
export interface PaymentServiceInterface {
  createPayment(data: {
    orderId: string;
    paymentId: string;
    method: PaymentMethod;
    provider: PaymentProvider;
    idempotencyKey?: string;
  }): Promise<{
    paymentId: string;
    provider: PaymentProvider;
    status: PaymentProcessingStatus;
    amount: number;
  }>;
}

// Address type
export interface Address {
  addressLine1: string;
  addressLine2?: string;
  ward: string;
  district: string;
  province: string;
  country?: string;
}

// Receiver type
export interface Receiver {
  fullName: string;
  phone: string;
}

// VAT Invoice Info type
export interface VatInvoiceInfo {
  companyName: string;
  taxCode: string;
  companyAddress?: string;
  recipientEmail: string;
}

// Extended CreateOrderFromCartDto with proper types
export interface ExtendedCreateOrderFromCartDto extends CreateOrderFromCartDto {
  receiver: Receiver;
  shippingAddress?: Address;
  vatInvoice?: VatInvoiceInfo;
  guestContact?: Receiver;
}

// Order creation context type
export interface OrderCreationContext {
  user: CheckoutUser;
  createOrderDto: ExtendedCreateOrderFromCartDto;
  cartItems: CartItemResponseDto[];
  saleChannelId: string;
  warehouseId: string;
  bankAccount: BankAccount | null;
  orderCode: string;
  totals: OrderTotals;
  itemsWithInventory: CartItemWithInventory[];
}

// Error handling types
export interface CheckoutError extends Error {
  code?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Stock validation result type
export interface StockValidationResult {
  hasEnoughStock: boolean;
  availableStock: number;
  requestedQuantity: number;
  productName: string;
}

// Order status update type
export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  reason?: string;
}

// Payment status update type
export interface PaymentStatusUpdate {
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentId?: string;
}

// Inventory update type
export interface InventoryUpdate {
  productId: string;
  warehouseId: string;
  quantity: number;
  operation: 'reserve' | 'release' | 'commit';
}

// Order summary type for response
export interface OrderSummary {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  createdAt: Date;
}

// Cart validation result type
export interface CartValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  items: CartItemResponseDto[];
}

// Delivery validation result type
export interface DeliveryValidationResult {
  isValid: boolean;
  errors: string[];
  deliveryType: number;
  address?: Address;
  warehouseId?: string;
}

// Payment validation result type
export interface PaymentValidationResult {
  isValid: boolean;
  errors: string[];
  method: PaymentMethod;
  provider?: PaymentProvider;
}

// Complete checkout validation result type
export interface CheckoutValidationResult {
  cart: CartValidationResult;
  delivery: DeliveryValidationResult;
  payment: PaymentValidationResult;
  inventory: InventoryValidationResult;
  overall: ValidationResult;
}
