import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';

@Injectable()
export class KiotVietProductUtil {
  private readonly logger = new Logger(KiotVietProductUtil.name);

  /**
   * Generate a barcode for a product
   */
  generateBarcode(productCode: string): string {
    // Generate a 13-digit barcode using product code and random numbers
    const cleanCode = productCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');

    // Take first 4 characters of product code, add timestamp and random
    const barcode = `${cleanCode.slice(0, 4).padEnd(4, '0')}${timestamp}${random}`;
    return barcode.slice(0, 13).padEnd(13, '0');
  }

  /**
   * Generate a URL-friendly slug from product name
   */
  generateSlug(productName: string, productCode?: string): string {
    // Clean and normalize the product name
    const cleanName = productName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Add product code if available for uniqueness
    const codeSlug = productCode
      ? `-${productCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`
      : '';

    // Add random suffix for uniqueness
    const randomSuffix = nanoid(6).toLowerCase();

    return `${cleanName}${codeSlug}-${randomSuffix}`;
  }

  /**
   * Generate a strong password for business users
   */
  generateBusinessPassword(productCode: string): string {
    const cleanCode = productCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    const symbols = '!@#$%';
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];

    return `Business${cleanCode}${timestamp}${symbol}`;
  }

  /**
   * Generate a dummy email for business users
   */
  generateBusinessEmail(productCode: string, businessName?: string): string {
    const cleanCode = productCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanName = businessName
      ? businessName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      : 'business';

    const randomId = nanoid(4).toLowerCase();
    return `${cleanName}.${cleanCode}.${randomId}@kiotviet-sync.local`;
  }

  /**
   * Generate a phone number for business users
   */
  generateBusinessPhone(): string {
    // Generate a Vietnamese phone number format
    const prefixes = ['090', '091', '093', '094', '096', '097', '098', '099'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 10000000)
      .toString()
      .padStart(7, '0');

    return `0${prefix.slice(1)}${suffix}`;
  }

  /**
   * Generate a reference ID for business users
   */
  generateBusinessReferenceId(profileCount: number): string {
    const formattedCount = (profileCount + 11000).toString();
    return `VN-${formattedCount}`.toLowerCase();
  }

  /**
   * Generate a warehouse name from KiotViet branch data
   */
  generateWarehouseName(branchName?: string, branchId?: number): string {
    if (branchName) {
      return branchName;
    }
    return `Kho KiotViet ${branchId || 'Default'}`;
  }

  /**
   * Generate a warehouse code
   */
  generateWarehouseCode(branchId?: number): string {
    const randomId = nanoid(4).toUpperCase();
    return `KV-WH-${branchId || 'DEF'}-${randomId}`;
  }

  /**
   * Generate a business slug
   */
  generateBusinessSlug(businessName: string, businessId?: number): string {
    const cleanName = businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const randomSuffix = nanoid(4).toLowerCase();
    const idSuffix = businessId ? `-${businessId}` : '';

    return `${cleanName}${idSuffix}-${randomSuffix}`;
  }

  /**
   * Generate category slug
   */
  generateCategorySlug(categoryName: string, categoryId?: number): string {
    const cleanName = categoryName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const randomSuffix = nanoid(4).toLowerCase();
    const idSuffix = categoryId ? `-${categoryId}` : '';

    return `${cleanName}${idSuffix}-${randomSuffix}`;
  }
}
