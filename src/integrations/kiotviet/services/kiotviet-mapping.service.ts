import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { KiotVietConfigService } from './kiotviet-config.service';
import { KiotVietProductItem } from '../../interfaces';
import { JwtPayload } from '../../../auth/jwt-payload';

@Injectable()
export class KiotVietMappingService {
  private readonly logger = new Logger(KiotVietMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: KiotVietConfigService,
  ) {}

  /**
   * Map KiotViet product to Product entity
   */
  async mapKiotVietProductToProduct(
    kiotvietProduct: KiotVietProductItem,
    user: JwtPayload,
  ) {
    try {
      // Get field mappings from config
      const config = await this.configService.getConfig(user);
      // Note: fieldMappings is already the product mappings from the config
      const fieldMappings = config?.fieldMappings || {};

      // Generate slug from name
      const slug = this.generateSlug(
        kiotvietProduct.name || kiotvietProduct.fullName,
      );

      // Map category
      let categoryId: string | undefined;
      if (kiotvietProduct.categoryId) {
        const category = await this.findOrCreateCategory(
          kiotvietProduct.categoryId,
          kiotvietProduct.categoryName,
        );
        categoryId = category.id;
      }

      // Brand/Supplier mapping not used in current schema

      // Process images
      const images = kiotvietProduct.images || [];
      const mainImage = images.length > 0 ? images[0] : '';

      // Calculate pricing
      const basePrice = kiotvietProduct.basePrice || 0;
      const price = this.calculatePriceWithTax(
        basePrice,
        kiotvietProduct.taxRate,
      );

      // Create specifications object
      const specifications = {
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
      };

      // Create product data object
      const productData = {
        name: kiotvietProduct.name || kiotvietProduct.fullName,
        slug,
        description: kiotvietProduct.description || '',
        shortDescription: kiotvietProduct.description || '',

        // Pricing
        price: price,
        originalPrice: basePrice > price ? basePrice : undefined,
        discount:
          basePrice > price
            ? Math.round(((basePrice - price) / basePrice) * 100)
            : 0,
        vipDiscount: 0,

        // Inventory
        sku: kiotvietProduct.code,
        stock: 0, // Will be updated by inventory sync
        minStock: 0,
        maxStock: null,

        // Images
        mainImage,
        images,

        // Ratings & Reviews
        rating: 0,
        reviewCount: 0,
        sold: 0,

        // Status
        isActive: kiotvietProduct.isActive && kiotvietProduct.allowsSale,
        isNew: false,
        isBestSeller: false,
        isFeatured: false,

        // Features
        features: [],
        specifications,
        variants: kiotvietProduct.hasVariants ? {} : null,

        // Shipping & Warranty
        weight: kiotvietProduct.weight || null,
        dimensions: null,
        freeShipping: false,
        warranty: false,
        warrantyPeriod: null,

        // SEO
        metaTitle: kiotvietProduct.name || kiotvietProduct.fullName,
        metaDescription: kiotvietProduct.description || '',
        keywords: [],

        // Relationships
        categoryId,
      };

      return productData;
    } catch (error) {
      this.logger.error(
        `Error mapping KiotViet product ${kiotvietProduct.code}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  }

  /**
   * Calculate price with tax
   */
  private calculatePriceWithTax(basePrice: number, taxRate: string): number {
    if (!taxRate || taxRate === '0' || taxRate === '0%') {
      return basePrice;
    }

    const taxRateNumber = parseFloat(taxRate.replace('%', ''));
    if (isNaN(taxRateNumber)) {
      return basePrice;
    }

    return basePrice * (1 + taxRateNumber / 100);
  }

  /**
   * Find or create category
   */
  private async findOrCreateCategory(
    kiotvietCategoryId: number,
    categoryName: string,
  ) {
    // First try to find existing category by KiotViet ID
    let category = await this.prisma.category.findFirst({
      where: {
        OR: [
          { slug: `kiotviet-${kiotvietCategoryId}` },
          { name: categoryName },
        ],
      },
    });

    if (!category) {
      // Create new category
      category = await this.prisma.category.create({
        data: {
          name: categoryName,
          slug: `kiotviet-${kiotvietCategoryId}`,
          description: `Danh mục được đồng bộ từ KiotViet: ${categoryName}`,
          isActive: true,
          sortOrder: 0,
        },
      });
    }

    return category;
  }

  // Brand/Supplier helper methods removed (not used with current schema)
}
