import { OriginSource, ProductType, TaxType } from '@prisma/client';
import { KiotVietProductItem } from '../../../../integrations/interfaces';

export class KiotVietProductMapping {
  id: string;

  code: string;
  masterCode?: string;
  masterProductId?: string;
  masterProductName?: string;

  // KiotViet integration - Tích hợp KiotViet
  kiotVietProductId?: number;
  masterKiotVietProductId?: number;
  masterKiotVietUnitId?: number;

  thumbnail: string;
  images: KiotVietProductImageMapping[];

  name: string;
  barCode?: string;
  slug: string;
  description?: string;
  type: ProductType;
  weight?: number;
  dimensions?: string;
  source: OriginSource;
  price: number;
  basePrice: number;
  minQuantity: number;
  maxQuantity?: number;
  orderTemplate?: string;

  isActive: boolean;
  allowsSale: boolean;

  specifications: Record<string, any>;

  freeShipping: boolean;

  metaTitle: string;
  metaDescription: string;
  keywords: string[];

  isLotSerialControl: boolean;
  isBatchExpireControl: boolean;
  isRewardPoint: boolean;

  taxType: TaxType;
  taxRate: string;
  taxRateDirect: number;
  taxName: string;

  unit: string;
  conversionValue: number;
  masterUnitId: string;
  masterUnitName: string;

  categoryId: string;
  categoryName: string;

  businessId: string;
  businessName: string;

  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<KiotVietProductMapping>) {
    Object.assign(this, partial);
  }

  static fromKiotVietProduct(
    kiotvietProduct: KiotVietProductItem,
  ): KiotVietProductMapping {
    // Generate slug from name
    const slug =
      kiotvietProduct.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || '';

    // Convert images array to mapping format
    const images: KiotVietProductImageMapping[] = (
      kiotvietProduct.images || []
    ).map((url, index) => ({
      id: `${kiotvietProduct.id}_${index}`,
      url,
      sortOrder: index,
      isMain: index === 0,
      productId: kiotvietProduct.id.toString(),
      productName: kiotvietProduct.name,
      createdAt: kiotvietProduct.createdDate,
      updatedAt: kiotvietProduct.modifiedDate || kiotvietProduct.createdDate,
    }));

    return {
      id: kiotvietProduct.id.toString(),
      code: kiotvietProduct.code,
      masterCode: kiotvietProduct.code,
      masterProductId: kiotvietProduct.masterProductId?.toString(),
      masterProductName: kiotvietProduct.name,
      kiotVietProductId: kiotvietProduct.id,
      masterKiotVietProductId: kiotvietProduct.masterProductId,
      masterKiotVietUnitId: kiotvietProduct.masterUnitId,
      thumbnail: (kiotvietProduct.images && kiotvietProduct.images[0]) || '',
      images,
      name: kiotvietProduct.name,
      barCode: kiotvietProduct.barCode,
      slug,
      description: kiotvietProduct.description || kiotvietProduct.fullName,
      type: 'SIMPLE' as ProductType, // Default type, can be mapped based on kiotvietProduct.type
      weight: kiotvietProduct.weight,
      dimensions: '', // Not available in KiotViet
      source: 'KIOTVIET' as OriginSource,
      price: kiotvietProduct.basePrice || 0,
      basePrice: kiotvietProduct.basePrice || 0,
      minQuantity: kiotvietProduct.minQuantity || 0,
      maxQuantity: kiotvietProduct.maxQuantity,
      orderTemplate: kiotvietProduct.orderTemplate || '',
      isActive: kiotvietProduct.isActive,
      allowsSale: kiotvietProduct.allowsSale,
      specifications: {
        weight: kiotvietProduct.weight,
        unit: kiotvietProduct.unit,
        conversionValue: kiotvietProduct.conversionValue,
        isLotSerialControl: kiotvietProduct.isLotSerialControl,
        isBatchExpireControl: kiotvietProduct.isBatchExpireControl,
        taxType: kiotvietProduct.taxType,
        taxRate: kiotvietProduct.taxRate,
        taxname: kiotvietProduct.taxname,
        type: kiotvietProduct.type,
        orderTemplate: kiotvietProduct.orderTemplate,
      },
      freeShipping: false, // Default value
      metaTitle: kiotvietProduct.name,
      metaDescription:
        kiotvietProduct.description || kiotvietProduct.fullName || '',
      keywords: [kiotvietProduct.name, kiotvietProduct.code].filter(Boolean),
      isLotSerialControl: kiotvietProduct.isLotSerialControl || false,
      isBatchExpireControl: kiotvietProduct.isBatchExpireControl || false,
      isRewardPoint: kiotvietProduct.isRewardPoint || false,
      taxType: 'INCLUSIVE' as TaxType, // Default mapping, can be refined based on kiotvietProduct.taxType
      taxRate: kiotvietProduct.taxRate || '',
      taxRateDirect: kiotvietProduct.taxRateDirect || 0,
      taxName: kiotvietProduct.taxname || '',
      unit: kiotvietProduct.unit || '',
      conversionValue: kiotvietProduct.conversionValue || 1,
      masterUnitId: kiotvietProduct.masterUnitId?.toString() || '',
      masterUnitName: kiotvietProduct.unit || '',
      categoryId: kiotvietProduct.categoryId?.toString() || '',
      categoryName: kiotvietProduct.categoryName || '',
      businessId: kiotvietProduct.tradeMarkId?.toString() || '',
      businessName: kiotvietProduct.tradeMarkName || '',
      createdAt: kiotvietProduct.createdDate,
      updatedAt: kiotvietProduct.modifiedDate || kiotvietProduct.createdDate,
    };
  }
}

export class KiotVietProductInventoryMapping {
  id: string;

  kiotVietWarehouseId: number;

  cost: number;
  onHand: number;
  onOrder: number;
  reserved: number;
  actualReserved: number;
  minQuantity: number;
  maxQuantity: number;
  source: string;

  warehouseId: string;
  warehouseName: string;

  productId: string;
  productName: string;

  createdAt: Date;
  updatedAt: Date;
}

export class KiotVietProductImageMapping {
  id: string;

  url: string;
  sortOrder: number;
  isMain: boolean;

  productId: string;
  productName: string;

  createdAt: Date;
  updatedAt: Date;
}
