import { Injectable } from '@nestjs/common';
import { KiotVietProductItem } from '../../../../interfaces/kiotviet.product.interface';
import { KiotVietProductUtil } from '../../../utils/kiotviet-product.util';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class KiotVietProductMappingHelper {
  constructor(private readonly productUtil: KiotVietProductUtil) {}

  /**
   * Build product data object from KiotViet product
   */
  buildProductData(
    kiotVietProduct: KiotVietProductItem,
    categoryId: string,
    businessId: string,
  ): any {
    // Validate required fields
    if (!kiotVietProduct || !kiotVietProduct.code || !kiotVietProduct.name) {
      throw new Error('Invalid product data: missing required fields');
    }

    // Log the product data for debugging
    console.log('Building product data for:', {
      code: kiotVietProduct.code,
      name: kiotVietProduct.name,
      unit: kiotVietProduct.unit,
      conversionValue: kiotVietProduct.conversionValue,
    });

    const slug = this.productUtil.generateSlug(kiotVietProduct.name);
    const thumbnail = kiotVietProduct.images?.[0] || '';

    // Clean and validate the data before building
    const cleanedData = {
      code: kiotVietProduct.code,
      kiotVietProductId: kiotVietProduct.id,
      kiotVietModifiedDate: this.parseKiotVietDate(
        kiotVietProduct.modifiedDate,
      ),
      kiotVietCategoryId: kiotVietProduct.categoryId,
      kiotVietBusinessId: kiotVietProduct.tradeMarkId,
      masterKiotVietProductId: kiotVietProduct.masterProductId || null,
      masterKiotVietUnitId: kiotVietProduct.masterUnitId || null,
      name: kiotVietProduct.name,
      barCode: kiotVietProduct.barCode || null,
      slug,
      description:
        kiotVietProduct.description || kiotVietProduct.fullName || null,
      type: this.mapProductType(kiotVietProduct.type),
      weight: kiotVietProduct.weight || null,
      source: 'kiotviet',
      price: new Decimal(kiotVietProduct.basePrice || 0),
      basePrice: new Decimal(kiotVietProduct.basePrice || 0),
      minQuantity: kiotVietProduct.minQuantity || 1,
      maxQuantity: kiotVietProduct.maxQuantity || null,
      thumbnail,
      isActive: kiotVietProduct.isActive,
      allowsSale: kiotVietProduct.allowsSale,
      specifications: this.buildSpecifications(kiotVietProduct),
      isLotSerialControl: kiotVietProduct.isLotSerialControl || false,
      isBatchExpireControl: kiotVietProduct.isBatchExpireControl || false,
      isRewardPoint: kiotVietProduct.isRewardPoint || false,
      taxType: this.mapTaxType(
        kiotVietProduct.taxType,
        kiotVietProduct.taxRate,
      ),
      taxRate: kiotVietProduct.taxRate || null,
      taxRateDirect: kiotVietProduct.taxRateDirect || null,
      taxName: kiotVietProduct.taxname || null,
      unit: kiotVietProduct.unit || 'Cái', // Default unit if not provided
      conversionValue: new Decimal(kiotVietProduct.conversionValue || 1),
      categoryId,
      businessId,
    };

    // Remove undefined values and ensure required fields have values
    const finalData = Object.fromEntries(
      Object.entries(cleanedData).filter(([_, value]) => value !== undefined),
    );

    // Ensure required fields have proper values
    if (!finalData.unit) {
      finalData.unit = 'Cái'; // Default unit
    }

    if (!finalData.conversionValue) {
      finalData.conversionValue = new Decimal(1); // Default conversion value
    }

    // Ensure price and basePrice are Decimal objects
    if (finalData.price && typeof finalData.price === 'number') {
      finalData.price = new Decimal(finalData.price);
    }

    if (finalData.basePrice && typeof finalData.basePrice === 'number') {
      finalData.basePrice = new Decimal(finalData.basePrice);
    }

    // Ensure minQuantity is a number
    if (finalData.minQuantity && typeof finalData.minQuantity !== 'number') {
      finalData.minQuantity = 1;
    }

    // Ensure type is valid
    if (!finalData.type) {
      finalData.type = 'product'; // Default type
    }

    // Log the final data for debugging
    console.log('Final product data:', {
      code: finalData.code,
      unit: finalData.unit,
      conversionValue: finalData.conversionValue,
      price: finalData.price,
      basePrice: finalData.basePrice,
    });

    return finalData;
  }

  /**
   * Parse KiotViet date string to valid DateTime
   * Handles various date formats that KiotViet might send
   */
  private parseKiotVietDate(dateString: any): Date | null {
    if (!dateString) return null;

    try {
      // Handle string dates from KiotViet
      if (typeof dateString === 'string') {
        // Fix common KiotViet date format issues
        let cleanDateString = dateString;

        // Remove extra zeros after milliseconds (e.g., "2025-08-22T13:49:08.8030000" -> "2025-08-22T13:49:08.803")
        cleanDateString = cleanDateString.replace(/\.(\d{3})\d+/, '.$1');

        // Try parsing the cleaned date
        const parsedDate = new Date(cleanDateString);

        // Validate the parsed date
        if (isNaN(parsedDate.getTime())) {
          console.warn(`Invalid date format from KiotViet: ${dateString}`);
          return null;
        }

        return parsedDate;
      }

      // Handle Date objects
      if (dateString instanceof Date) {
        return dateString;
      }

      return null;
    } catch (error) {
      console.warn(`Error parsing KiotViet date: ${dateString}`, error);
      return null;
    }
  }

  /**
   * Map product type from KiotViet to system enum
   */
  mapProductType(kiotVietType: number): string {
    switch (kiotVietType) {
      case 1:
        return 'combo';
      case 2:
        return 'service';
      case 3:
        return 'product';
      default:
        return 'product';
    }
  }

  /**
   * Map tax type from KiotViet to system enum
   */
  mapTaxType(kiotVietTaxType: string, taxRate?: string): string {
    if (!kiotVietTaxType) return 'zero';

    const normalizedTaxType = kiotVietTaxType.toLowerCase().trim();

    // Direct mapping for specific tax codes
    const directTaxTypeMap: Record<string, string> = {
      '0%': 'zero',
      zero: 'zero',
      '5%': 'five',
      five: 'five',
      '8%': 'eight',
      eight: 'eight',
      '10%': 'ten',
      ten: 'ten',
      kct: 'kct',
      kkknt: 'kkknt',
      khau_tru: 'khac', // Map khau_tru to khac
    };

    // Check direct mapping first
    if (directTaxTypeMap[normalizedTaxType]) {
      return directTaxTypeMap[normalizedTaxType];
    }

    // Map based on tax rate percentage
    if (taxRate) {
      const rate = parseFloat(taxRate.replace('%', '').trim());
      if (!isNaN(rate)) {
        if (rate === 0) return 'zero';
        if (rate === 5) return 'five';
        if (rate === 8) return 'eight';
        if (rate === 10) return 'ten';
      }
    }

    return 'khac';
  }

  /**
   * Build product specifications from KiotViet product
   */
  buildSpecifications(kiotVietProduct: KiotVietProductItem): any {
    return {
      weight: kiotVietProduct.weight,
      unit: kiotVietProduct.unit,
      conversionValue: kiotVietProduct.conversionValue,
      masterUnitId: kiotVietProduct.masterUnitId,
      isLotSerialControl: kiotVietProduct.isLotSerialControl,
      isBatchExpireControl: kiotVietProduct.isBatchExpireControl,
      isRewardPoint: kiotVietProduct.isRewardPoint,
      taxType: kiotVietProduct.taxType,
      taxRate: kiotVietProduct.taxRate,
      orderTemplate: kiotVietProduct.orderTemplate,
    };
  }

  /**
   * Extract unique categories from products
   */
  extractUniqueCategories(
    products: any[],
  ): Array<{ id: number; name: string }> {
    const categoryMap = new Map<number, string>();

    products.forEach((product) => {
      if (product.categoryId && product.categoryName) {
        categoryMap.set(product.categoryId, product.categoryName);
      }
    });

    return Array.from(categoryMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  /**
   * Extract unique trademarks from products
   */
  extractUniqueTradeMarks(
    products: any[],
  ): Array<{ id: number; name: string }> {
    const tradeMarkMap = new Map<number, string>();

    products.forEach((product) => {
      // Try multiple possible field names for trademark data
      let tradeMarkId =
        product.tradeMarkId || product.businessId || product.kiotVietBusinessId;
      let tradeMarkName =
        product.tradeMarkName || product.businessName || product.business?.name;

      if (tradeMarkId && tradeMarkName) {
        // Convert to number for trademark ID mapping
        const businessIdNum = parseInt(tradeMarkId.toString());
        if (!isNaN(businessIdNum)) {
          tradeMarkMap.set(businessIdNum, tradeMarkName);
        }
      }
    });

    // Debug logging for troubleshooting
    if (tradeMarkMap.size === 0 && products.length > 0) {
      console.log(
        'DEBUG: No trademarks found. Sample product structure:',
        JSON.stringify(products[0], null, 2),
      );
    }

    return Array.from(tradeMarkMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  /**
   * Extract unique branches from products
   */
  extractUniqueBranches(products: any[]): Array<{ id: number; name: string }> {
    const branchMap = new Map<number, string>();

    products.forEach((product) => {
      if (product.inventories) {
        product.inventories.forEach((inventory: any) => {
          if (inventory.branchId && inventory.branchName) {
            branchMap.set(inventory.branchId, inventory.branchName);
          }
        });
      }
    });

    // Debug logging removed - can be added back if needed
    return Array.from(branchMap.entries()).map(([id, name]) => ({ id, name }));
  }
}
