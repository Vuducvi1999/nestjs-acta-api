import { OriginSource, ProductType, TaxType } from '@prisma/client';

export class ProductItemResponseDto {
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

  count: {
    inventories: number;
    ratings: number;
    reviews: number;
    featured: number;
    order: number;
    cart: number;
    wishlist: number;
    variant: number;
    attribute: number;
    unit: number;
    priceBook: number;
    formula: number;
    serial: number;
    batchExpire: number;
    warranty: number;
    shelf: number;
    invoice: number;
    purchaseOrder: number;
    returnOrder: number;
    transfer: number;
    orderBusiness: number;
  };

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

  constructor(partial: Partial<ProductItemResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(product: any): ProductItemResponseDto {
    return {
      ...product,
    };
  }

  static fromProduct(product: any): ProductItemResponseDto {
    return {
      id: product.id,
      code: product.code,
      masterCode: product.masterCode,
      masterProductId: product.masterProductId,
      masterProductName: product.masterProduct?.name,
      kiotVietProductId: product.kiotVietProductId,
      masterKiotVietProductId: product.masterKiotVietProductId,
      masterKiotVietUnitId: product.masterKiotVietUnitId,
      thumbnail: product.thumbnail,
      name: product.name,
      barCode: product.barCode,
      slug: product.slug,
      description: product.description,
      type: product.type,
      weight: product.weight,
      dimensions: product.dimensions,
      source: product.source,
      price: Number(product.price),
      basePrice: Number(product.basePrice),
      minQuantity: product.minQuantity,
      maxQuantity: product.maxQuantity,
      orderTemplate: product.orderTemplate?.name,
      count: {
        inventories: product._count?.inventories || 0,
        ratings: product._count?.ratings || 0,
        reviews: product._count?.reviews || 0,
        featured: product._count?.featuredIn || 0,
        order: product._count?.orderDetails || 0,
        cart: product._count?.cartItems || 0,
        wishlist: product._count?.wishlistItems || 0,
        variant: product._count?.variants || 0,
        attribute: product._count?.attributes || 0,
        unit: product._count?.units || 0,
        priceBook: product._count?.priceBooks || 0,
        formula: product._count?.formulas || 0,
        serial: product._count?.serials || 0,
        batchExpire: product._count?.batchExpires || 0,
        warranty: product._count?.warranties || 0,
        shelf: product._count?.shelves || 0,
        invoice: product._count?.invoiceDetails || 0,
        purchaseOrder: product._count?.purchaseOrderDetails || 0,
        returnOrder: product._count?.returnOrderDetails || 0,
        transfer: product._count?.transferDetails || 0,
        orderBusiness: product._count?.orderBusinessDetails || 0,
      },
      isActive: product.isActive,
      allowsSale: product.allowsSale,
      specifications: product.specifications || {},
      freeShipping: product.freeShipping,
      metaTitle: product.metaTitle || '',
      metaDescription: product.metaDescription || '',
      keywords: product.keywords || [],
      isLotSerialControl: product.isLotSerialControl,
      isBatchExpireControl: product.isBatchExpireControl,
      isRewardPoint: product.isRewardPoint,
      taxType: product.taxType,
      taxRate: product.taxRate || '',
      taxRateDirect: product.taxRateDirect || 0,
      taxName: product.taxName || '',
      unit: product.unit,
      conversionValue: Number(product.conversionValue),
      masterUnitId: product.masterUnitId || '',
      masterUnitName: product.masterUnit?.name || '',
      categoryId: product.categoryId,
      categoryName: product.category?.name || '',
      businessId: product.businessId,
      businessName: product.business?.name || '',
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}

export class PaginatedProductResponseDto {
  data: ProductItemResponseDto[];

  total: number;

  page: number;

  totalPages: number;

  static fromPaginatedProducts(result: any): PaginatedProductResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
