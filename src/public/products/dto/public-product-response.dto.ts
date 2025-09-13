import {
  ProductType,
  TaxType,
  WarrantyType,
  WarrantyTimeType,
} from '@prisma/client';

export class PublicProductItemResponseDto {
  id: string;

  code: string;
  masterCode?: string;
  masterProductId?: string;
  masterProductName?: string;

  thumbnail: string;
  name: string;
  slug: string;

  type: ProductType;
  price: number;
  basePrice: number;

  priceMin?: number;
  priceMax?: number;
  hasVariants: boolean;
  variantCount?: number;

  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  available?: number;

  business?: { id: string; name: string; slug: string };
  category?: { id: string; name: string; slug: string };

  rating: { average: number; count: number };

  badges?: string[];

  freeShipping: boolean;
  seo?: { metaTitle?: string; metaDescription?: string };

  shortDescription?: string;

  createdAt: Date;

  constructor(partial: Partial<PublicProductItemResponseDto>) {
    Object.assign(this, partial);
  }

  static fromProduct(product: any): PublicProductItemResponseDto {
    return {
      id: product.id,
      code: product.code,
      masterCode: product.masterCode,
      masterProductId: product.masterProductId,
      masterProductName: product.masterProduct?.name,
      thumbnail: product.thumbnail,
      name: product.name,
      slug: product.slug,
      type: product.type,
      price: product.price,
      basePrice: product.basePrice,
      priceMin: product.priceMin,
      priceMax: product.priceMax,
      hasVariants: product.hasVariants,
      variantCount: product.variantCount,
      stockStatus: product.stockStatus,
      available: product.available,
      business: {
        id: product.businessId,
        name: product.businessName,
        slug: product.businessSlug,
      },
      category: {
        id: product.categoryId,
        name: product.categoryName,
        slug: product.categorySlug,
      },
      rating: product.rating,
      badges: product.badges,
      freeShipping: product.freeShipping,
      seo: product.seo,
      shortDescription: product.shortDescription,
      createdAt: product.createdAt,
    };
  }
}

export class PaginatedPublicProductResponseDto {
  data: PublicProductItemResponseDto[];

  total: number;

  page: number;

  totalPages: number;

  static fromPaginatedProducts(result: any): PaginatedPublicProductResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}

export class PublicProductDetailDto {
  // Định danh & cơ bản
  id: string;
  slug: string;
  code?: string; // SKU chung; SKU cụ thể nằm ở biến thể
  name: string;
  description?: string;
  type: ProductType;

  // Media
  thumbnail: string;
  images: Array<{ url: string; isMain: boolean; sortOrder: number }>;

  // Brand/Business & Category (để breadcrumb/brand page)
  brand: { id: string; name: string; slug: string };
  category: {
    id: string;
    name: string;
    slug: string;
    breadcrumbs: Array<{ id: string; name: string; slug: string }>;
  };

  // Giá & Thuế (đã tính sẵn cho FE)
  pricing: {
    price: number; // Giá cuối cùng có hiệu lực cho đơn vị bán mặc định
    originalPrice?: number; // Giá trước giảm (nếu có)
    currency: 'VND';
    display: 'tax_included' | 'tax_excluded';
    tax?: {
      type?: TaxType;
      rate?: number;
      name?: string;
    };
    priceMin?: number; // khi có biến thể
    priceMax?: number;
  };

  // Đơn vị bán
  unit: {
    default: string; // product.unit
    options?: Array<{
      id: string;
      name: string;
      unit: string;
      conversionValue: number;
    }>; // từ ProductUnit[]
  };

  // Biến thể
  variants: {
    options: Array<{ name: string; values: string[] }>; // ví dụ: Size:[S,M,L], Color:[Red,Blue]
    items: Array<{
      sku: string;
      attributes: Record<string, string>; // { Size:'M', Color:'Red' }
      additionalPrice?: number; // cộng thêm so với price base
      image?: string;
      stock: number; // tồn khả dụng của biến thể (nếu quản lý riêng)
      barCode?: string;
      weight?: number;
    }>;
  };

  // Tồn kho & mua hàng
  availability: {
    available: number; // Σ(onHand) - max(reserved, actualReserved)
    minQuantity: number; // minQuantity để đặt
    maxQuantity?: number; // nếu có giới hạn
    perWarehouse?: Array<{
      warehouseId: string;
      name: string;
      available: number;
    }>; // nếu cần BOPIS/hiển thị theo kho
  };

  // Vận chuyển & kích thước
  shipping: {
    freeShipping: boolean;
    weight?: number; // kg
    dimensions?: string; // "LxWxH cm"
  };

  // Bảo hành (rút gọn để hiển thị)
  warranty?: {
    summary: string; // ví dụ: "Bảo hành 12 tháng điện tử"
    items: Array<{
      type: WarrantyType;
      duration?: number; // numberTime
      timeType?: WarrantyTimeType;
      description?: string;
    }>;
  };

  // Thông số kỹ thuật / Thuộc tính hiển thị
  specifications?: Record<string, string | number | boolean>;
  attributes?: Array<{ name: string; value: string }>;

  // Đánh giá
  rating: { average: number; count: number };

  // Review tóm tắt (chi tiết review qua endpoint riêng)
  topReviews?: Array<PublicReviewDto>;

  // Combo/BOM (nếu type = combo): liệt kê thành phần
  bundleItems?: Array<{
    productId: string;
    slug: string;
    name: string;
    quantity: number;
  }>;

  // SEO
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    canonicalUrl?: string;
    structuredData?: any; // JSON-LD nếu backend muốn render SSR
  };

  // Nhãn/flag marketing
  badges?: string[]; // ['new','best_seller','low_stock','free_ship',...]

  updatedAt: string; // ISO (hỗ trợ cache/ISR)
}

export class PublicReviewDto {
  id: string;
  rating: number; // 1..5
  title?: string;
  content: string;
  images?: string[];
  isVerified: boolean;
  likeCount: number;
  createdAt: string; // ISO

  // Ẩn PII: chỉ public displayName đã ẩn danh
  user: { displayName: string; avatarUrl?: string }; // ví dụ "Nguyễn A***"
}

export class PublicBrandDetailDto {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  productCount: number;
  rating?: number;
  createdAt?: Date;

  static fromBusiness(business: any): PublicBrandDetailDto {
    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logoUrl:
        business.logo || business.avatar || business.avatarUrl || undefined,
      description: business.description || undefined,
      productCount: business._count?.products || 0,
      rating: business.rating || undefined,
      createdAt: business.createdAt,
    };
  }
}
