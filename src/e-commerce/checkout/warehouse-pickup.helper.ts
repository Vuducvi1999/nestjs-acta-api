import { PrismaService } from '../../common/services/prisma.service';
import {
  PublicPickupItemAvailabilityDto,
  PublicWarehousePickupListResponseDto,
  PublicWarehousePickupOptionDto,
  PublicWarehouseSummaryDto,
} from './dto/public-warehouse-pickup.dto';

export type CartItemSlim = {
  productId: string;
  quantity: number;
  slug?: string;
  name?: string;
  image?: string;
};

function computeAvailable(inv: any): number {
  if (typeof inv?.available === 'number') return inv.available;
  const onHand = Number(inv?.onHand ?? 0);
  const reserved = Number(inv?.reserved ?? 0);
  const actualReserved = Number(inv?.actualReserved ?? 0);
  const lock = Math.max(reserved, actualReserved);
  return Math.max(onHand - lock, 0);
}

async function summarizeForWarehouse(
  prisma: PrismaService,
  warehouse: PublicWarehouseSummaryDto,
  items: CartItemSlim[],
): Promise<PublicWarehousePickupOptionDto> {
  if (!warehouse.isActive) {
    const mapped = items.map<PublicPickupItemAvailabilityDto>((i) => ({
      productId: i.productId,
      slug: i.slug,
      name: i.name,
      image: i.image,
      requiredQty: i.quantity,
      availableQtyAtWarehouse: 0,
      missingQty: i.quantity,
      status: 'out_of_stock',
    }));

    return {
      warehouse,
      canChoose: false,
      fulfillment: 'delayed_pickup',
      etaDays: { min: 3, max: 4 },
      reason: 'inactive_warehouse',
      items: mapped,
      totals: {
        totalItems: mapped.length,
        itemsFullyInStock: 0,
        itemsPartialOrOut: mapped.length,
      },
      message:
        'Kho đang tạm ngưng nhận hàng tại chỗ. Bạn vẫn có thể đặt và nhận sau 3–4 ngày.',
    };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];

  const invRows = await prisma.productInventory.findMany({
    where: {
      warehouseId: warehouse.id,
      productId: { in: productIds },
    },
    select: {
      productId: true,
      onHand: true,
      reserved: true,
      actualReserved: true,
    },
  });

  const byProduct = new Map<string, number>();
  for (const r of invRows) {
    byProduct.set(r.productId, computeAvailable(r));
  }

  const detail = items.map<PublicPickupItemAvailabilityDto>((i) => {
    const avail = Number(byProduct.get(i.productId) ?? 0);
    const missing = Math.max(i.quantity - avail, 0);
    let status: 'in_stock' | 'partial' | 'out_of_stock' = 'in_stock';
    if (avail <= 0) status = 'out_of_stock';
    else if (missing > 0) status = 'partial';

    return {
      productId: i.productId,
      slug: i.slug,
      name: i.name,
      image: i.image,
      requiredQty: i.quantity,
      availableQtyAtWarehouse: avail,
      missingQty: missing,
      status,
    };
  });

  const itemsFullyInStock = detail.filter(
    (d) => d.status === 'in_stock',
  ).length;
  const itemsPartialOrOut = detail.length - itemsFullyInStock;
  const allInStock = itemsPartialOrOut === 0;

  return {
    warehouse,
    canChoose: true,
    fulfillment: allInStock ? 'immediate_pickup' : 'delayed_pickup',
    etaDays: allInStock ? undefined : { min: 3, max: 4 },
    reason: allInStock ? undefined : 'insufficient_stock',
    items: detail,
    totals: {
      totalItems: detail.length,
      itemsFullyInStock,
      itemsPartialOrOut,
    },
    message: allInStock
      ? 'Tất cả sản phẩm đều có sẵn. Bạn có thể đến lấy ngay trong ngày.'
      : 'Một số sản phẩm chưa đủ tại kho này. Bạn vẫn có thể đặt và đến lấy sau 3–4 ngày.',
  };
}

export async function buildPickupOptionsForCart(
  prisma: PrismaService,
  cartItems: CartItemSlim[],
  chosenWarehouseId?: string,
): Promise<PublicWarehousePickupListResponseDto> {
  // Handle empty cart case
  if (!cartItems || cartItems.length === 0) {
    return { options: [], chosenWarehouseId };
  }

  const warehouses = await prisma.warehouse.findMany({
    where: {},
    select: {
      id: true,
      name: true,
      isActive: true,
      address: {
        select: {
          street: true,
          ward: true,
          district: true,
          city: true,
          country: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const options: PublicWarehousePickupOptionDto[] = [];
  for (const w of warehouses) {
    options.push(
      await summarizeForWarehouse(
        prisma,
        {
          id: w.id,
          name: w.name,
          isActive: w.isActive,
          address: w.address
            ? {
                line1: w.address.street,
                ward: w.address.ward ?? undefined,
                district: w.address.district ?? undefined,
                city: w.address.city,
                country: w.address.country,
              }
            : undefined,
        },
        cartItems,
      ),
    );
  }

  return { options, chosenWarehouseId };
}
