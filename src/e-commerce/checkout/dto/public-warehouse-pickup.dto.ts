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

  // summary over the whole cart
  canChoose: boolean; // FE always can choose; this indicates button enabled (true)
  fulfillment: 'immediate_pickup' | 'delayed_pickup';
  etaDays?: { min: number; max: number }; // set when delayed
  reason?: 'insufficient_stock' | 'inactive_warehouse';

  // per-item details
  items: PublicPickupItemAvailabilityDto[];

  // quick totals
  totals: {
    totalItems: number;
    itemsFullyInStock: number;
    itemsPartialOrOut: number;
  };

  // recommendation text for UX
  message: string;
}

export class PublicWarehousePickupListResponseDto {
  options: PublicWarehousePickupOptionDto[];
  chosenWarehouseId?: string;
}
