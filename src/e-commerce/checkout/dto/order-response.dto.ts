import {
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryType } from '../../shared/dto/index.dto';
import { PublicProductItemResponseDto } from '../../../public/products/dto/public-product-response.dto';
import { PublicProductHelper } from '../../../public/products/public-product.helper';
// If you created the DeliveryType enum as discussed (1 = Ship COD, 2 = Pickup)

// ---------- Small helpers ----------
const toNumber = (v: any) => (typeof v === 'number' ? v : v ? Number(v) : 0);

const pickNotEmpty = <T>(...vals: (T | undefined | null | '')[]) =>
  vals.find((v) => v !== undefined && v !== null && v !== '') as T | undefined;

// ---------- Item (line) ----------
export class OrderItemResponseDto {
  @ApiProperty({
    description: 'ID của item trong đơn hàng',
    example: 'item_1234567890abcdef',
  })
  orderItemId: string;

  @ApiProperty({
    description: 'Số lượng sản phẩm',
    example: 2,
    type: Number,
  })
  quantity: number;

  @ApiProperty({
    description: 'Đơn giá sản phẩm (VND)',
    example: 150000,
    type: Number,
  })
  unitPrice: number;

  @ApiProperty({
    description: 'Tổng tiền của item (VND)',
    example: 300000,
    type: Number,
  })
  lineTotal: number;

  // Prefer full product (joined); fallback to snapshot
  @ApiProperty({
    description: 'Thông tin sản phẩm',
    type: PublicProductItemResponseDto,
  })
  product: PublicProductItemResponseDto;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2024-01-15T10:30:00.000Z',
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật cuối',
    example: '2024-01-15T10:30:00.000Z',
    type: Date,
  })
  updatedAt: Date;

  constructor(partial: Partial<OrderItemResponseDto>) {
    Object.assign(this, partial);
  }

  static fromOrderItem(item: any): OrderItemResponseDto {
    // If the relation `product` is loaded, transform; else build from snapshot fields on item
    const productLike = item.product
      ? PublicProductHelper.transformProductForPublicResponse(item.product)
      : {
          id: item.productId,
          code: item.productCode,
          name: item.productName,
          slug: item.productSlug ?? undefined,
          thumbnail: item.productThumbnail ?? undefined,
          type: item.productType ?? 'product',
          price: toNumber(item.unitPrice), // lock price to the snapshot
          basePrice: toNumber(item.unitPrice),
          stockStatus: 'in_stock',
          available: undefined,
          hasVariants: Boolean(item.variantId),
          business: item.productBusiness
            ? {
                id: item.productBusiness.id,
                name: item.productBusiness.name,
                slug: item.productBusiness.slug,
              }
            : undefined,
          category: item.productCategory
            ? {
                id: item.productCategory.id,
                name: item.productCategory.name,
                slug: item.productCategory.slug,
              }
            : undefined,
          rating: { average: 0, count: 0 },
          freeShipping: false,
        };

    const transformed = PublicProductItemResponseDto.fromProduct(productLike);

    const unitPrice = toNumber(item.price) || toNumber(item.unitPrice) || transformed.price || 0;
    const quantity = toNumber(item.quantity) || 0;

    return new OrderItemResponseDto({
      orderItemId: item.id,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      product: transformed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
}

// ---------- Customer ----------
export class OrderCustomerInfoDto {
  @ApiPropertyOptional({
    description: 'Họ tên người nhận hàng',
    example: 'Nguyễn Văn A',
  })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại người nhận hàng',
    example: '0901234567',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Email người nhận hàng',
    example: 'nguyenvana@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'ID của user (nếu có)',
    example: 'user_1234567890abcdef',
  })
  userId?: string; // Add userId for validation

  // Optional structured address to render "Địa chỉ"
  @ApiPropertyOptional({
    description: 'Địa chỉ dòng 1',
    example: '123 Đường ABC',
  })
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ dòng 2',
    example: 'Tầng 2, Phòng 201',
  })
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'Tỉnh/Thành phố',
    example: 'Hà Nội',
  })
  province?: string;

  @ApiPropertyOptional({
    description: 'Quận/Huyện',
    example: 'Ba Đình',
  })
  district?: string;

  @ApiPropertyOptional({
    description: 'Phường/Xã',
    example: 'Phúc Xá',
  })
  ward?: string;

  @ApiPropertyOptional({
    description: 'Mã bưu điện',
    example: '10000',
  })
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Quốc gia',
    example: 'VN',
    default: 'VN',
  })
  country?: string;

  constructor(partial: Partial<OrderCustomerInfoDto>) {
    Object.assign(this, partial);
  }

  static fromOrder(order: any): OrderCustomerInfoDto {
    // Prefer delivery receiver snapshot → then customer profile
    const d = order.delivery ?? {};
    const c = order.customer ?? {};
    return new OrderCustomerInfoDto({
      fullName: pickNotEmpty(d.receiverName, c.fullName),
      phone: pickNotEmpty(d.receiverPhone, c.phone),
      email: pickNotEmpty(order.contactEmail, c.email),
      userId: c.userId, // Include userId from customer
      addressLine1: d.addressLine1,
      addressLine2: d.addressLine2,
      province: d.province,
      district: d.district,
      ward: d.ward,
      postalCode: d.postalCode,
      country: 'VN',
    });
  }
}

// ---------- Delivery ----------
export class OrderDeliveryInfoDto {
  @ApiPropertyOptional({
    description: 'Loại giao hàng',
    enum: DeliveryType,
    example: DeliveryType.ShipCOD,
  })
  type?: DeliveryType; // 1 = Ship COD, 2 = Pickup

  @ApiPropertyOptional({
    description: 'Mã phương thức vận chuyển',
    example: 'standard',
  })
  shippingMethodCode?: string; // e.g., 'standard'

  @ApiPropertyOptional({
    description: 'Tên phương thức vận chuyển',
    example: 'Giao hàng tiêu chuẩn',
  })
  shippingMethodLabel?: string; // UI label (optional)

  @ApiProperty({
    description: 'Phí vận chuyển (VND)',
    example: 30000,
    type: Number,
  })
  fee: number;

  @ApiPropertyOptional({
    description: 'Thời gian giao hàng theo yêu cầu',
    example: '2024-01-20T14:00:00.000Z',
    type: Date,
  })
  scheduledAt?: Date; // requested schedule (if any)

  @ApiPropertyOptional({
    description: 'Thời gian giao hàng dự kiến',
    example: '2024-01-18T10:00:00.000Z',
    type: Date,
  })
  eta?: Date; // estimated date if you store it

  constructor(partial: Partial<OrderDeliveryInfoDto>) {
    Object.assign(this, partial);
  }

  static fromOrder(order: any): OrderDeliveryInfoDto {
    const d = order.delivery ?? {};
    return new OrderDeliveryInfoDto({
      type: d.type as DeliveryType | undefined,
      shippingMethodCode: d.shippingMethodCode ?? d.methodCode,
      shippingMethodLabel:
        d.shippingMethodLabel ?? d.shippingMethodCode ?? undefined,
      fee: toNumber(d.fee),
      scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : undefined,
      eta: order.estimatedDeliveryAt
        ? new Date(order.estimatedDeliveryAt)
        : undefined,
    });
  }
}

// ---------- Payment ----------
export class OrderPaymentInfoDto {
  provider?: PaymentProvider; // vnpay | stripe | vietqr | ...
  method?: PaymentMethod; // cash | transfer | card | ...
  status?: PaymentStatus; // created | pending | succeeded | failed | ...
  displayName?: string; // e.g., 'cod', 'vietqr', 'vnpay'
  redirectUrl?: string; // if available for hosted payments
  qrPayload?: string; // vietqr payload (optional)
  qrImageBase64?: string; // vietqr image (optional)

  constructor(partial: Partial<OrderPaymentInfoDto>) {
    Object.assign(this, partial);
  }

  static fromOrder(order: any): OrderPaymentInfoDto {
    // Choose the "current" payment: succeeded > pending > created
    const payments: any[] = order.payments ?? [];
    const byStatusRank = (p: any) => {
      const s = p.status;
      if (s === 'succeeded') return 0;
      if (s === 'pending') return 1;
      if (s === 'created') return 2;
      return 9;
    };
    const current =
      payments.sort((a, b) => byStatusRank(a) - byStatusRank(b))[0] ?? {};

    return new OrderPaymentInfoDto({
      provider: current.provider as PaymentProvider | undefined,
      method: current.method as PaymentMethod | undefined,
      status: current.status as PaymentStatus | undefined,
      displayName: (current.provider ?? current.method ?? 'cod') as string,
      redirectUrl: current.redirectUrl ?? undefined,
      qrPayload: current.metadata?.payload ?? undefined,
      qrImageBase64: current.metadata?.qrImageBase64 ?? undefined,
    });
  }
}

export class OrderSummaryDto {
  orderId: string;
  orderCode: string;

  status: OrderStatus; // e.g., 'awaiting_payment'
  paymentStatus: PaymentStatus; // e.g., 'processing'

  // suggest exposing these as ISO strings (or use @Type(() => Date))
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

// ---------- Payment Preview DTO ----------
export class OrderPaymentPreviewDto {
  @ApiProperty({
    description: 'Phương thức thanh toán',
    enum: PaymentMethod,
    example: PaymentMethod.transfer,
  })
  method: PaymentMethod; // 'transfer'

  @ApiProperty({
    description: 'Nhà cung cấp thanh toán',
    enum: PaymentProvider,
    example: PaymentProvider.vietqr,
  })
  provider: PaymentProvider; // 'vietqr'

  @ApiProperty({
    description: 'Trạng thái thanh toán',
    enum: PaymentStatus,
    example: PaymentStatus.processing,
  })
  status: PaymentStatus; // 'processing'

  @ApiProperty({
    description: 'Số tiền cần thanh toán',
    example: 480000,
    type: Number,
  })
  amount: number; // total to pay

  @ApiProperty({
    description: 'Đơn vị tiền tệ',
    example: 'VND',
  })
  currency: 'VND'; // lock your currency here

  @ApiPropertyOptional({
    description: 'Thời gian hết hạn thanh toán dự kiến',
    example: '2024-01-15T11:30:00.000Z',
    type: Date,
  })
  expectedPayExpiresAt?: Date; // mirrors OrderPayment.expiresAt if you set it

  constructor(partial: Partial<OrderPaymentPreviewDto>) {
    Object.assign(this, partial);
  }
}

// ---------- Step 1: Order Response DTO (for order creation) ----------
export class OrderResponseDto {
  @ApiProperty({
    description: 'ID của đơn hàng',
    example: 'order_1234567890abcdef',
  })
  orderId: string;

  @ApiProperty({
    description: 'Mã đơn hàng',
    example: 'HN-250827-023',
  })
  orderCode: string;

  @ApiProperty({
    description: 'Trạng thái đơn hàng',
    enum: OrderStatus,
    example: OrderStatus.draft,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Trạng thái thanh toán',
    enum: PaymentStatus,
    example: PaymentStatus.processing,
  })
  paymentStatus: PaymentStatus;

  @ApiProperty({
    description: 'Thời gian tạo đơn hàng',
    example: '2024-01-15T10:30:00.000Z',
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Thời gian cập nhật cuối',
    example: '2024-01-15T10:30:00.000Z',
    type: Date,
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Thời gian thanh toán',
    example: '2024-01-15T10:35:00.000Z',
    type: Date,
  })
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'Thời gian hoàn thành',
    example: '2024-01-18T14:00:00.000Z',
    type: Date,
  })
  completedAt?: Date;

  @ApiPropertyOptional({
    description: 'Thời gian hủy',
    example: '2024-01-15T11:00:00.000Z',
    type: Date,
  })
  cancelledAt?: Date;

  @ApiProperty({
    description: 'Tổng tiền hàng (chưa bao gồm phí vận chuyển và giảm giá)',
    example: 500000,
    type: Number,
  })
  subtotal: number;

  @ApiProperty({
    description: 'Phí vận chuyển',
    example: 30000,
    type: Number,
  })
  shippingFee: number;

  @ApiProperty({
    description: 'Tổng giảm giá',
    example: 50000,
    type: Number,
  })
  discount: number;

  @ApiProperty({
    description: 'Tổng tiền cần thanh toán',
    example: 480000,
    type: Number,
  })
  total: number;

  @ApiProperty({
    description: 'Danh sách sản phẩm trong đơn hàng',
    type: [OrderItemResponseDto],
  })
  items: OrderItemResponseDto[];

  @ApiProperty({
    description: 'Thông tin thanh toán',
    type: OrderPaymentPreviewDto,
  })
  paymentPreview: OrderPaymentPreviewDto;

  constructor(partial: Partial<OrderResponseDto>) {
    Object.assign(this, partial);
  }

  static fromOrder(order: any): OrderResponseDto {
    const items = (order.items ?? []).map((i: any) =>
      OrderItemResponseDto.fromOrderItem(i),
    );

    // Get the current payment (processing status for Step 1)
    const currentPayment = (order.payments ?? []).find(
      (p: any) => p.status === 'processing',
    );

    const paymentPreview = new OrderPaymentPreviewDto({
      method: currentPayment?.method || 'transfer',
      provider: currentPayment?.provider || 'vietqr',
      status: currentPayment?.status || 'processing',
      amount: toNumber(order.grandTotal) || toNumber(order.total),
      currency: 'VND',
      expectedPayExpiresAt: currentPayment?.expiresAt
        ? new Date(currentPayment.expiresAt)
        : undefined,
    });

    return new OrderResponseDto({
      orderId: order.id,
      orderCode: order.code,
      status: order.status as OrderStatus,
      paymentStatus: (currentPayment?.status as PaymentStatus) || 'processing',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt ? new Date(order.paidAt) : undefined,
      completedAt: order.completedAt ? new Date(order.completedAt) : undefined,
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : undefined,
      subtotal: toNumber(order.subtotal),
      shippingFee: toNumber(order.shippingFee) || toNumber(order.delivery?.fee),
      discount: toNumber(order.discountTotal) || toNumber(order.discount),
      total: toNumber(order.grandTotal) || toNumber(order.total),
      items,
      paymentPreview,
    });
  }
}

// ---------- Totals ----------
export class OrderTotalsResponseDto {
  itemsCount: number; // total items (sum quantities)
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;

  constructor(partial: Partial<OrderTotalsResponseDto>) {
    Object.assign(this, partial);
  }

  static fromOrder(order: any): OrderTotalsResponseDto {
    const items = (order.items ?? []).map((i: any) =>
      OrderItemResponseDto.fromOrderItem(i),
    );
    const itemsCount = items.reduce((s, i) => s + i.quantity, 0);

    // Prefer order snapshots; if missing, compute fallback
    const fallbackSubtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    return new OrderTotalsResponseDto({
      itemsCount,
      subtotal: toNumber(order.subtotal) || fallbackSubtotal,
      discountTotal: toNumber(order.discountTotal),
      shippingFee: toNumber(order.shippingFee) || toNumber(order.delivery?.fee),
      taxTotal: toNumber(order.taxTotal),
      grandTotal:
        toNumber(order.grandTotal) ||
        (toNumber(order.subtotal) || fallbackSubtotal) -
          toNumber(order.discountTotal) +
          (toNumber(order.shippingFee) || toNumber(order.delivery?.fee)) +
          toNumber(order.taxTotal),
      currency: order.currency ?? 'VND',
    });
  }
}

// ---------- Full Order (for the success page) ----------
export class PublicOrderDetailResponseDto {
  orderId: string;
  code: string; // e.g., ORD-1756...
  status: OrderStatus;
  placedAt: Date; // Ngày đặt
  estimatedDeliveryAt?: Date; // Dự kiến giao (nếu có)

  payment: OrderPaymentInfoDto;
  delivery: OrderDeliveryInfoDto;
  customer: OrderCustomerInfoDto;

  // UI list
  items: OrderItemResponseDto[];

  // “Tóm tắt thanh toán”
  summary: OrderTotalsResponseDto;

  // Optional context for UX
  saleChannelId?: string;
  warehouseId?: string;

  // Payment information for electronic payments
  paymentInfo?: {
    paymentId: string;
    provider: PaymentProvider;
    status: string;
    amount: number;
  };

  constructor(partial: Partial<PublicOrderDetailResponseDto>) {
    Object.assign(this, partial);
  }

  static fromOrder(order: any): PublicOrderDetailResponseDto {
    const items = (order.items ?? []).map((i: any) =>
      OrderItemResponseDto.fromOrderItem(i),
    );

    // Get payment info if available
    let paymentInfo:
      | {
          paymentId: string;
          provider: PaymentProvider;
          status: string;
          amount: number;
        }
      | undefined = undefined;
    if (order.paymentInfo) {
      paymentInfo = {
        paymentId: order.paymentInfo.paymentId,
        provider: order.paymentInfo.provider,
        status: order.paymentInfo.status,
        amount: Number(order.paymentInfo.amount),
      };
    }

    return new PublicOrderDetailResponseDto({
      orderId: order.id,
      code: order.code,
      status: order.status as OrderStatus,
      placedAt: order.createdAt,
      estimatedDeliveryAt:
        order.estimatedDeliveryAt ?? order.delivery?.scheduledAt ?? undefined,
      payment: OrderPaymentInfoDto.fromOrder(order),
      delivery: OrderDeliveryInfoDto.fromOrder(order),
      customer: OrderCustomerInfoDto.fromOrder(order),
      items,
      summary: OrderTotalsResponseDto.fromOrder(order),
      saleChannelId: order.saleChannelId,
      warehouseId: order.warehouseId,
      paymentInfo,
    });
  }
}

// ---------- Optional: paginated orders (list/history) ----------
export class PublicOrderListItemResponseDto {
  orderId: string;
  code: string;
  status: OrderStatus;
  placedAt: Date;
  grandTotal: number;
  currency: string;

  // quick glance
  itemsCount: number;
  firstItem?: OrderItemResponseDto;

  static fromOrder(order: any): PublicOrderListItemResponseDto {
    const items = (order.items ?? []).map((i: any) =>
      OrderItemResponseDto.fromOrderItem(i),
    );
    return {
      orderId: order.id,
      code: order.code,
      status: order.status as OrderStatus,
      placedAt: order.createdAt,
      grandTotal: toNumber(order.grandTotal),
      currency: order.currency ?? 'VND',
      itemsCount: items.reduce((s, i) => s + i.quantity, 0),
      firstItem: items[0],
    };
  }
}

export class PaginatedPublicOrdersResponseDto {
  items: PublicOrderListItemResponseDto[];
  totalItems: number;
  page: number;
  totalPages: number;

  static fromResult(result: {
    orders: any[];
    totalItems: number;
    page: number;
    totalPages: number;
  }): PaginatedPublicOrdersResponseDto {
    return {
      items: result.orders.map((o) =>
        PublicOrderListItemResponseDto.fromOrder(o),
      ),
      totalItems: result.totalItems,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
