import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../common/services/prisma.service';
import { ProductType, TaxType, OriginSource, Prisma } from '@prisma/client';
import { KiotVietProductItem } from '../../../../interfaces/kiotviet.product.interface';
import { KiotVietApiListResponse } from '../../../../interfaces/kiotviet.common.interface';
import {
  ProductSyncStats,
  ProductSyncResult,
} from '../../../interfaces/sync.interface';

@Injectable()
export class KiotVietProductCrudService {
  private readonly logger = new Logger(KiotVietProductCrudService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enhanced product sync with CREATE, UPDATE, DELETE operations
   */
  async syncProductsCrud(
    kiotVietProducts: KiotVietProductItem[],
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    removeIds?: number[],
  ): Promise<ProductSyncResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        return await this.syncProductsCrudWithTransaction(
          tx,
          kiotVietProducts,
          categoryMap,
          businessMap,
          warehouseMap,
          removeIds,
        );
      });
    } catch (error) {
      this.logger.error('Product sync transaction failed:', error);
      return {
        success: false,
        stats: {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: 1,
          totalProcessed: 0,
        },
        errors: [`Transaction failed: ${error.message}`],
      };
    }
  }

  /**
   * Enhanced product sync with CREATE, UPDATE, DELETE operations using provided transaction
   */
  async syncProductsCrudWithTransaction(
    tx: any,
    kiotVietProducts: KiotVietProductItem[],
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    removeIds?: number[],
  ): Promise<ProductSyncResult> {
    const stats: ProductSyncStats = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
      totalProcessed: 0,
    };
    const errors: string[] = [];

    // 1. Handle product deletions first (based on removeIds)
    if (removeIds && removeIds.length > 0) {
      await this.handleProductDeletions(tx, removeIds, stats, errors);
    }

    // 2. Get existing products from database for comparison
    const existingProducts = await this.getExistingProducts(tx);
    const existingProductMap = new Map(
      existingProducts.map((p) => [p.kiotVietProductId!, p]),
    );

    // 3. Pre-fetch all existing slugs to optimize slug generation
    const existingSlugs = await this.getExistingSlugs(tx);
    const slugGenerator = new SlugGenerator(existingSlugs);

    // 4. Process KiotViet products for CREATE/UPDATE operations
    for (const kiotVietProduct of kiotVietProducts) {
      try {
        const existingProduct = existingProductMap.get(kiotVietProduct.id);

        if (existingProduct) {
          // UPDATE existing product
          if (this.hasProductChanged(existingProduct, kiotVietProduct)) {
            await this.updateProduct(
              tx,
              existingProduct,
              kiotVietProduct,
              categoryMap,
              businessMap,
            );
            stats.updated++;
          }
        } else {
          // CREATE new product
          await this.createProduct(
            tx,
            kiotVietProduct,
            categoryMap,
            businessMap,
            warehouseMap,
            slugGenerator,
          );
          stats.created++;
        }

        stats.totalProcessed++;
      } catch (error) {
        this.logger.error(
          `Error processing product ${kiotVietProduct.id}:`,
          error,
        );
        errors.push(`Product ${kiotVietProduct.id}: ${error.message}`);
        stats.errors++;
      }
    }

    return {
      success: stats.errors === 0,
      stats,
      errors,
    };
  }

  /**
   * Handle product deletions based on removeIds from KiotViet
   */
  private async handleProductDeletions(
    tx: any,
    removeIds: number[],
    stats: ProductSyncStats,
    errors: string[],
  ): Promise<void> {
    this.logger.log(`Processing ${removeIds.length} product deletions`);

    try {
      // Find products to delete
      const productsToDelete = await tx.product.findMany({
        where: {
          kiotVietProductId: { in: removeIds },
          source: OriginSource.kiotviet,
        },
        select: { id: true, kiotVietProductId: true, name: true },
      });

      for (const product of productsToDelete) {
        try {
          // Soft delete - mark as inactive rather than hard delete to maintain referential integrity
          await tx.product.update({
            where: { id: product.id },
            data: {
              isActive: false,
              description: `${product.name} - Đã xóa từ KiotViet vào ${new Date().toISOString()}`,
            },
          });

          this.logger.debug(
            `Soft deleted product: ${product.name} (KiotViet ID: ${product.kiotVietProductId})`,
          );
          stats.deleted++;
        } catch (error) {
          this.logger.error(
            `Failed to delete product ${product.kiotVietProductId}:`,
            error,
          );
          errors.push(
            `Delete product ${product.kiotVietProductId}: ${error.message}`,
          );
          stats.errors++;
        }
      }
    } catch (error) {
      this.logger.error('Failed to process product deletions:', error);
      errors.push(`Product deletions failed: ${error.message}`);
    }
  }

  /**
   * Get existing products from database
   */
  private async getExistingProducts(tx: any): Promise<any[]> {
    return await tx.product.findMany({
      where: {
        source: OriginSource.kiotviet,
        kiotVietProductId: { not: null },
      },
      select: {
        id: true,
        kiotVietProductId: true,
        kiotVietCategoryId: true,
        kiotVietBusinessId: true,
        kiotVietModifiedDate: true,
        masterKiotVietProductId: true,
        masterKiotVietUnitId: true,
        code: true,
        name: true,
        type: true,
        price: true,
        basePrice: true,
        isActive: true,
        allowsSale: true,
        taxType: true,
        taxRate: true,
        taxName: true,
        taxRateDirect: true,
        barCode: true,
        weight: true,
        masterUnitId: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Check if product has changed and needs updating (comprehensive field validation)
   */
  private hasProductChanged(
    existingProduct: any,
    kiotVietProduct: KiotVietProductItem,
  ): boolean {
    // Always update if any critical field is NULL and KiotViet has data
    const nullFieldsNeedingUpdate = this.getNullFieldsNeedingUpdate(
      existingProduct,
      kiotVietProduct,
    );

    if (nullFieldsNeedingUpdate.length > 0) {
      this.logger.debug(
        `Product ${kiotVietProduct.code} has NULL fields that need updating: ${nullFieldsNeedingUpdate.join(', ')}`,
      );
      return true;
    }

    // Check tax consistency (if taxRate exists but taxType is wrong)
    if (this.needsTaxValidation(existingProduct, kiotVietProduct)) {
      this.logger.debug(
        `Product ${kiotVietProduct.code} needs tax validation update`,
      );
      return true;
    }

    // Check master unit assignment
    if (!existingProduct.masterUnitId && kiotVietProduct.masterUnitId) {
      this.logger.debug(
        `Product ${kiotVietProduct.code} needs master unit assignment`,
      );
      return true;
    }

    // Standard field comparison for actual changes
    const fieldsToCompare = [
      { existing: existingProduct.name, kiotviet: kiotVietProduct.name },
      {
        existing: existingProduct.price?.toString(),
        kiotviet: kiotVietProduct.basePrice?.toString(),
      },
      {
        existing: existingProduct.isActive,
        kiotviet: kiotVietProduct.isActive,
      },
      {
        existing: existingProduct.allowsSale,
        kiotviet: kiotVietProduct.allowsSale,
      },
      { existing: existingProduct.taxRate, kiotviet: kiotVietProduct.taxRate },
    ];

    const hasChanges = fieldsToCompare.some(
      (field) => field.existing !== field.kiotviet,
    );

    // Check modification date
    if (kiotVietProduct.modifiedDate && existingProduct.updatedAt) {
      const kiotVietModified = new Date(kiotVietProduct.modifiedDate);
      const existingUpdated = new Date(existingProduct.updatedAt);
      return kiotVietModified > existingUpdated || hasChanges;
    }

    return hasChanges;
  }

  /**
   * Get list of NULL fields that can be updated with KiotViet data
   */
  private getNullFieldsNeedingUpdate(
    existingProduct: any,
    kiotVietProduct: KiotVietProductItem,
  ): string[] {
    const nullFields: string[] = [];

    // Check critical KiotViet ID fields
    if (!existingProduct.kiotVietCategoryId && kiotVietProduct.categoryId) {
      nullFields.push('kiotVietCategoryId');
    }
    if (!existingProduct.kiotVietBusinessId && kiotVietProduct.tradeMarkId) {
      nullFields.push('kiotVietBusinessId');
    }
    if (!existingProduct.kiotVietModifiedDate && kiotVietProduct.modifiedDate) {
      nullFields.push('kiotVietModifiedDate');
    }
    if (
      !existingProduct.masterKiotVietProductId &&
      kiotVietProduct.masterProductId
    ) {
      nullFields.push('masterKiotVietProductId');
    }
    if (!existingProduct.masterKiotVietUnitId && kiotVietProduct.masterUnitId) {
      nullFields.push('masterKiotVietUnitId');
    }

    // Check product data fields
    if (
      !existingProduct.barCode &&
      (kiotVietProduct.barCode || !existingProduct.barCode)
    ) {
      nullFields.push('barCode'); // Will generate if KiotViet doesn't have one
    }
    if (!existingProduct.weight && kiotVietProduct.weight) {
      nullFields.push('weight');
    }
    if (!existingProduct.taxType && kiotVietProduct.taxRate) {
      nullFields.push('taxType');
    }
    if (
      !existingProduct.taxName &&
      (kiotVietProduct.taxname || kiotVietProduct.taxRate)
    ) {
      nullFields.push('taxName');
    }
    if (!existingProduct.taxRateDirect && kiotVietProduct.taxRateDirect) {
      nullFields.push('taxRateDirect');
    }

    return nullFields;
  }

  /**
   * Check if tax fields need validation/correction
   */
  private needsTaxValidation(
    existingProduct: any,
    kiotVietProduct: KiotVietProductItem,
  ): boolean {
    if (!kiotVietProduct.taxRate) return false;

    // Check if taxType matches taxRate
    const expectedTaxType = this.mapTaxType(
      kiotVietProduct.taxType,
      kiotVietProduct.taxRate,
    );

    if (existingProduct.taxType !== expectedTaxType) {
      return true;
    }

    // Check if taxName matches taxType
    const expectedTaxName =
      kiotVietProduct.taxname || this.generateTaxName(expectedTaxType);
    if (existingProduct.taxName !== expectedTaxName) {
      return true;
    }

    return false;
  }

  /**
   * Create a new product
   */
  private async createProduct(
    tx: any,
    kiotVietProduct: KiotVietProductItem,
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    slugGenerator: SlugGenerator,
  ): Promise<void> {
    const categoryId = categoryMap.get(kiotVietProduct.categoryId);
    const businessId = businessMap.get(kiotVietProduct.tradeMarkId);

    if (!categoryId) {
      throw new Error(
        `Missing category mapping for categoryId: ${kiotVietProduct.categoryId}`,
      );
    }

    if (!businessId) {
      throw new Error(
        `Missing business mapping for tradeMarkId: ${kiotVietProduct.tradeMarkId}. Product: ${kiotVietProduct.name}. Please ensure the trademark exists in KiotViet.`,
      );
    }

    // Generate unique slug
    const slug = slugGenerator.generateUniqueSlug(kiotVietProduct.name);

    // Map tax information
    const taxType = this.mapTaxType(
      kiotVietProduct.taxType,
      kiotVietProduct.taxRate,
    );
    const taxName = kiotVietProduct.taxname || this.generateTaxName(taxType);

    // Create product
    const newProduct = await tx.product.create({
      data: {
        kiotVietProductId: kiotVietProduct.id,
        kiotVietCategoryId: kiotVietProduct.categoryId, // Store original KiotViet category ID
        kiotVietBusinessId: kiotVietProduct.tradeMarkId, // Store original KiotViet business/trademark ID
        kiotVietModifiedDate: kiotVietProduct.modifiedDate
          ? new Date(kiotVietProduct.modifiedDate)
          : null,
        masterKiotVietProductId: kiotVietProduct.masterProductId || null,
        masterKiotVietUnitId: kiotVietProduct.masterUnitId || null,
        code: kiotVietProduct.code,
        name: kiotVietProduct.name,
        barCode: this.generateBarCode(kiotVietProduct, businessMap),
        slug,
        description: this.buildProductDescription(kiotVietProduct),
        type: this.mapProductType(kiotVietProduct.type),
        weight: kiotVietProduct.weight || null,
        source: OriginSource.kiotviet,
        price: kiotVietProduct.basePrice || 0,
        basePrice: kiotVietProduct.basePrice || 0,
        minQuantity: kiotVietProduct.minQuantity || 1,
        maxQuantity: kiotVietProduct.maxQuantity || null,
        thumbnail: this.getProductThumbnail(kiotVietProduct),
        isActive: kiotVietProduct.isActive,
        allowsSale: kiotVietProduct.allowsSale,
        specifications: this.buildSpecifications(kiotVietProduct),
        isLotSerialControl: kiotVietProduct.isLotSerialControl || false,
        isBatchExpireControl: kiotVietProduct.isBatchExpireControl || false,
        isRewardPoint: kiotVietProduct.isRewardPoint || false,
        taxType,
        taxRate: kiotVietProduct.taxRate || null,
        taxRateDirect: kiotVietProduct.taxRateDirect || null,
        taxName,
        unit: kiotVietProduct.unit || 'Cái',
        conversionValue: kiotVietProduct.conversionValue || 1,
        categoryId, // Database category ID for relationship
        businessId, // Database business ID for relationship
      },
    });

    // Create default product unit
    await this.createDefaultProductUnit(tx, newProduct.id, kiotVietProduct);

    // Create related entities if needed
    if (kiotVietProduct.images?.length > 0) {
      await this.createProductImages(tx, newProduct.id, kiotVietProduct.images);
    }

    if (kiotVietProduct.inventories?.length > 0) {
      await this.createProductInventories(
        tx,
        newProduct.id,
        kiotVietProduct.inventories,
        warehouseMap,
      );
    }

    if (kiotVietProduct.attributes?.length > 0) {
      await this.createProductAttributes(
        tx,
        newProduct.id,
        kiotVietProduct.attributes,
      );
    }

    this.logger.debug(
      `Created product: ${newProduct.name} (${newProduct.code})`,
    );
  }

  /**
   * Update an existing product
   */
  private async updateProduct(
    tx: any,
    existingProduct: any,
    kiotVietProduct: KiotVietProductItem,
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
  ): Promise<void> {
    const categoryId = categoryMap.get(kiotVietProduct.categoryId);
    const businessId = businessMap.get(kiotVietProduct.tradeMarkId);

    if (!categoryId) {
      throw new Error(
        `Missing category mapping for categoryId: ${kiotVietProduct.categoryId}`,
      );
    }

    if (!businessId) {
      throw new Error(
        `Missing business mapping for tradeMarkId: ${kiotVietProduct.tradeMarkId}. Product: ${kiotVietProduct.name}. Please ensure the trademark exists in KiotViet.`,
      );
    }

    // Map tax information
    const taxType = this.mapTaxType(
      kiotVietProduct.taxType,
      kiotVietProduct.taxRate,
    );
    const taxName = kiotVietProduct.taxname || this.generateTaxName(taxType);

    // Update product
    await tx.product.update({
      where: { id: existingProduct.id },
      data: {
        kiotVietCategoryId: kiotVietProduct.categoryId, // Update KiotViet category ID
        kiotVietBusinessId: kiotVietProduct.tradeMarkId, // Update KiotViet business/trademark ID
        kiotVietModifiedDate: kiotVietProduct.modifiedDate
          ? new Date(kiotVietProduct.modifiedDate)
          : null,
        masterKiotVietProductId: kiotVietProduct.masterProductId || null,
        masterKiotVietUnitId: kiotVietProduct.masterUnitId || null,
        name: kiotVietProduct.name,
        barCode: this.generateOrUpdateBarCode(
          existingProduct,
          kiotVietProduct,
          businessMap,
        ),
        description: this.buildProductDescription(kiotVietProduct),
        type: this.mapProductType(kiotVietProduct.type),
        weight: kiotVietProduct.weight || null,
        price: kiotVietProduct.basePrice || 0,
        basePrice: kiotVietProduct.basePrice || 0,
        minQuantity: kiotVietProduct.minQuantity || 1,
        maxQuantity: kiotVietProduct.maxQuantity || null,
        thumbnail: this.getProductThumbnail(kiotVietProduct),
        isActive: kiotVietProduct.isActive,
        allowsSale: kiotVietProduct.allowsSale,
        specifications: this.buildSpecifications(kiotVietProduct),
        isLotSerialControl: kiotVietProduct.isLotSerialControl || false,
        isBatchExpireControl: kiotVietProduct.isBatchExpireControl || false,
        isRewardPoint: kiotVietProduct.isRewardPoint || false,
        taxType,
        taxRate: kiotVietProduct.taxRate || null,
        taxRateDirect: kiotVietProduct.taxRateDirect || null,
        taxName,
        unit: kiotVietProduct.unit || 'Cái',
        conversionValue: kiotVietProduct.conversionValue || 1,
        categoryId, // Database category ID for relationship
        businessId, // Database business ID for relationship
      },
    });

    // Handle master unit assignment if missing
    if (!existingProduct.masterUnitId) {
      await this.assignMasterUnitToExistingProduct(
        tx,
        existingProduct.id,
        kiotVietProduct,
      );
    }

    this.logger.debug(
      `Updated product: ${kiotVietProduct.name} (${kiotVietProduct.code})`,
    );
  }

  /**
   * Assign master unit to existing product that doesn't have one
   */
  private async assignMasterUnitToExistingProduct(
    tx: any,
    productId: string,
    kiotVietProduct: KiotVietProductItem,
  ): Promise<void> {
    // First, check if there are any existing ProductUnits for this product
    const existingUnits = await tx.productUnit.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    let masterUnitId: string | null = null;

    // Strategy 1: Use existing unit if available
    if (existingUnits.length > 0) {
      // Try to find unit matching KiotViet's masterUnitId
      if (kiotVietProduct.masterUnitId) {
        const matchingUnit = existingUnits.find(
          (unit) => unit.kiotVietUnitId === kiotVietProduct.masterUnitId,
        );
        if (matchingUnit) {
          masterUnitId = matchingUnit.id;
        }
      }

      // If no matching unit found, use the first existing unit
      if (!masterUnitId) {
        masterUnitId = existingUnits[0].id;
      }
    }

    // Strategy 2: Create a new unit if none exist
    if (!masterUnitId) {
      const newUnit = await tx.productUnit.create({
        data: {
          kiotVietUnitId: kiotVietProduct.masterUnitId || null,
          code: kiotVietProduct.code || `UNIT-${productId}`,
          name: kiotVietProduct.unit || 'Cái',
          unit: kiotVietProduct.unit || 'Cái',
          conversionValue: kiotVietProduct.conversionValue || 1,
          source: OriginSource.kiotviet,
          productId,
        },
      });
      masterUnitId = newUnit.id;
    }

    // Update product with master unit
    if (masterUnitId) {
      await tx.product.update({
        where: { id: productId },
        data: { masterUnitId },
      });

      this.logger.debug(
        `Assigned master unit ${masterUnitId} to product ${productId}`,
      );
    }
  }

  // Helper methods...

  /**
   * Map KiotViet product type to Prisma ProductType enum
   */
  private mapProductType(kiotVietType: number): ProductType {
    switch (kiotVietType) {
      case 1:
        return ProductType.combo;
      case 2:
        return ProductType.product;
      case 3:
        return ProductType.service;
      default:
        return ProductType.product;
    }
  }

  /**
   * Enhanced tax type mapping based on Vietnamese tax system
   */
  private mapTaxType(taxType: string, taxRate?: string): TaxType {
    const normalizedTaxType = taxType?.toString().trim().toUpperCase();
    const normalizedTaxRate = taxRate?.toString().trim();

    // Direct mapping for specific tax codes
    const directTaxTypeMap: Record<string, TaxType> = {
      KCT: TaxType.kct,
      KKKNT: TaxType.kkknt,
      KHAC: TaxType.khac,
    };

    if (normalizedTaxType && directTaxTypeMap[normalizedTaxType]) {
      return directTaxTypeMap[normalizedTaxType];
    }

    // Map based on tax rate percentage (handle both "10%" and "10" formats)
    if (normalizedTaxRate) {
      // Remove percentage sign and parse as number
      const cleanRate = normalizedTaxRate.replace('%', '').trim();
      const rate = parseFloat(cleanRate);
      if (!isNaN(rate)) {
        if (rate === 0) return TaxType.zero;
        if (rate === 5) return TaxType.five;
        if (rate === 8) return TaxType.eight;
        if (rate === 10) return TaxType.ten;
      }
    }

    return TaxType.khac;
  }

  /**
   * Generate Vietnamese tax name based on tax type
   */
  private generateTaxName(taxType: TaxType): string {
    const taxNameMap: Record<TaxType, string> = {
      [TaxType.zero]: 'Thuế suất 0%',
      [TaxType.five]: 'Thuế suất 5%',
      [TaxType.eight]: 'Thuế suất 8%',
      [TaxType.ten]: 'Thuế suất 10%',
      [TaxType.kct]: 'Không chịu thuế (KCT)',
      [TaxType.kkknt]: 'Không kê khai không nộp thuế (KKKNT)',
      [TaxType.khac]: 'Thuế suất khác',
    };

    return taxNameMap[taxType] || 'Thuế suất khác';
  }

  /**
   * Get all existing slugs from database
   */
  private async getExistingSlugs(tx: any): Promise<Set<string>> {
    const products = await tx.product.findMany({
      select: { slug: true },
    });
    return new Set(products.map((p: any) => p.slug));
  }

  /**
   * Get product thumbnail URL
   */
  private getProductThumbnail(product: KiotVietProductItem): string {
    return (
      product.images?.[0] || 'https://via.placeholder.com/300x300?text=No+Image'
    );
  }

  /**
   * Build specifications JSON from product data
   */
  private buildSpecifications(product: KiotVietProductItem): string | null {
    if (product.attributes?.length > 0) {
      return JSON.stringify(product.attributes);
    }
    return null;
  }

  /**
   * Build comprehensive product description from KiotViet data
   */
  private buildProductDescription(product: KiotVietProductItem): string {
    let description = '';

    // Use provided description or create from available data
    if (product.description) {
      description = product.description;
    } else {
      description = `Sản phẩm được đồng bộ từ KiotViet: ${product.name}`;
    }

    // Add additional info if available
    const additionalInfo: string[] = [];

    if (product.fullName && product.fullName !== product.name) {
      additionalInfo.push(`Tên đầy đủ: ${product.fullName}`);
    }

    if (product.hasVariants) {
      additionalInfo.push('Sản phẩm có biến thể');
    }

    if (product.orderTemplate) {
      additionalInfo.push(`Template đặt hàng: ${product.orderTemplate}`);
    }

    if (additionalInfo.length > 0) {
      description += `\n\n${additionalInfo.join('\n')}`;
    }

    return description;
  }

  /**
   * Generate barcode for new products
   */
  private generateBarCode(
    product: KiotVietProductItem,
    businessMap: Map<number, string>,
  ): string {
    // Use KiotViet barcode if available
    if (product.barCode && product.barCode.trim() !== '') {
      return product.barCode;
    }

    // Generate barcode in format: BUSINESS_CODE-PRODUCT_CODE
    const businessId = businessMap.get(product.tradeMarkId);
    let businessCode = 'UNKN'; // Default unknown business

    // Try to extract business code from trademark name
    if (product.tradeMarkName) {
      businessCode = product.tradeMarkName
        .replace(/[^A-Z0-9]/gi, '')
        .substring(0, 4)
        .toUpperCase();
    }

    const productCode = product.code
      .replace(/[^A-Z0-9]/gi, '')
      .substring(0, 8)
      .toUpperCase();

    return `${businessCode}${productCode}`;
  }

  /**
   * Generate or update barcode for existing products (only if NULL)
   */
  private generateOrUpdateBarCode(
    existingProduct: any,
    kiotVietProduct: KiotVietProductItem,
    businessMap: Map<number, string>,
  ): string {
    // Keep existing barcode if it exists
    if (existingProduct.barCode && existingProduct.barCode.trim() !== '') {
      return existingProduct.barCode;
    }

    // Use KiotViet barcode if available
    if (kiotVietProduct.barCode && kiotVietProduct.barCode.trim() !== '') {
      return kiotVietProduct.barCode;
    }

    // Generate new barcode for NULL values
    return this.generateBarCode(kiotVietProduct, businessMap);
  }

  /**
   * Create default product unit and handle masterUnitId assignment
   */
  private async createDefaultProductUnit(
    tx: any,
    productId: string,
    product: KiotVietProductItem,
  ): Promise<void> {
    let masterUnitId: string | null = null;

    // Strategy 1: If KiotViet has specific units array, process those first
    if (product.units?.length > 0) {
      const createdUnits: string[] = [];

      for (const unit of product.units) {
        const createdUnit = await tx.productUnit.create({
          data: {
            kiotVietUnitId: unit.id || null,
            code: unit.code || `UNIT-${productId}-${unit.id}`,
            name: unit.name || unit.unit || 'Cái',
            unit: unit.unit || 'Cái',
            conversionValue: unit.conversionValue || 1,
            source: OriginSource.kiotviet,
            productId,
          },
        });

        createdUnits.push(createdUnit.id);

        // If this unit matches the masterUnitId from KiotViet, use it as master
        if (unit.id === product.masterUnitId) {
          masterUnitId = createdUnit.id;
        }
      }

      // If no master unit was found from KiotViet's masterUnitId, use the first unit
      if (!masterUnitId && createdUnits.length > 0) {
        masterUnitId = createdUnits[0];
      }
    }

    // Strategy 2: If no units array or no master found, create a default unit
    if (!masterUnitId) {
      const defaultUnit = await tx.productUnit.create({
        data: {
          kiotVietUnitId: product.masterUnitId || null,
          code: product.code || `UNIT-${productId}`,
          name: product.unit || 'Cái',
          unit: product.unit || 'Cái',
          conversionValue: product.conversionValue || 1,
          source: OriginSource.kiotviet,
          productId,
        },
      });
      masterUnitId = defaultUnit.id;
    }

    // Update product to reference the master unit
    if (masterUnitId) {
      await tx.product.update({
        where: { id: productId },
        data: { masterUnitId },
      });
    }
  }

  /**
   * Create product images
   */
  private async createProductImages(
    tx: any,
    productId: string,
    images: string[],
  ): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      await tx.productImage.create({
        data: {
          url: images[i],
          sortOrder: i,
          isMain: i === 0,
          productId,
        },
      });
    }
  }

  /**
   * Create product inventories
   */
  private async createProductInventories(
    tx: any,
    productId: string,
    inventories: any[],
    warehouseMap: Map<number, string>,
  ): Promise<void> {
    for (const inventory of inventories) {
      const warehouseId = warehouseMap.get(inventory.branchId);
      if (warehouseId) {
        await tx.productInventory.create({
          data: {
            kiotVietWarehouseId: inventory.branchId,
            cost: inventory.cost || 0,
            onHand: inventory.onHand || 0,
            onOrder: inventory.onOrder || 0,
            reserved: inventory.reserved || 0,
            actualReserved: 0,
            minQuantity: inventory.minQuantity || 0,
            maxQuantity: inventory.maxQuantity || null,
            source: OriginSource.kiotviet,
            warehouseId,
            productId,
          },
        });
      }
    }
  }

  /**
   * Create product attributes
   */
  private async createProductAttributes(
    tx: any,
    productId: string,
    attributes: any[],
  ): Promise<void> {
    for (const attribute of attributes) {
      await tx.productAttribute.create({
        data: {
          attributeName: attribute.attributeName,
          attributeValue: attribute.attributeValue,
          source: OriginSource.kiotviet,
          productId,
        },
      });
    }
  }
}

/**
 * Helper class for generating unique slugs in memory to avoid repeated database queries
 */
class SlugGenerator {
  private usedSlugs: Set<string>;

  constructor(existingSlugs: Set<string>) {
    this.usedSlugs = new Set(existingSlugs);
  }

  generateUniqueSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
      .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i')
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u')
      .replace(/[ỳýỵỷỹ]/g, 'y')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (this.usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Mark this slug as used for future generations
    this.usedSlugs.add(slug);
    return slug;
  }
}
