// src/checkout/dto/public-warehouse-pickup.dto.ts
export type PickupItemStatus = 'in_stock' | 'partial' | 'out_of_stock';

export class PublicPickupItemAvailabilityDto {
  productId: string;
  slug?: string;
  name?: string;
  image?: string;

  requiredQty: number;
  availableQtyAtWarehouse: number;
  missingQty: number; // = max(required - available, 0)
  status: PickupItemStatus;
}

export class PublicWarehouseSummaryDto {
  id: string;
  name: string;
  isActive: boolean;
  address?: {
    line1?: string;
    line2?: string;
    ward?: string;
    district?: string;
    city?: string;
    country?: string;
  };
}

export class PublicWarehousePickupOptionDto {
  warehouse: PublicWarehouseSummaryDto;

  // Tóm tắt khả dụng cho toàn bộ giỏ
  canChoose: boolean; // true nếu tất cả item đều đủ hàng
  fulfillment: 'immediate_pickup' | 'delayed_pickup';
  etaDays?: { min: number; max: number }; // chỉ có khi delayed
  reason?: 'insufficient_stock' | 'inactive_warehouse';

  // Chi tiết theo từng item
  items: PublicPickupItemAvailabilityDto[];

  // Tổng hợp nhanh
  totals: {
    totalItems: number;
    itemsFullyInStock: number;
    itemsPartialOrOut: number;
  };

  // Gợi ý hiển thị
  message: string;
}

export class PublicWarehousePickupListResponseDto {
  options: PublicWarehousePickupOptionDto[];
  chosenWarehouseId?: string; // nếu FE đã chọn trước (optional)
}
