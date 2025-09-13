import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../common/services/prisma.service';
import { KiotVietProductMapping } from '../../dto/mapping/kiotviet-product-mapping.dto';
import {
  KiotVietBaseMapping,
  SyncStats,
} from '../../dto/mapping/kiotviet-base-mapping.dto';
import { KiotVietProductService } from '../kiot-viet.product.service';
import { JwtPayload } from '../../../../auth/jwt-payload';
import {
  KiotVietProductItem,
  KiotVietPaginationOptions,
  KiotVietApiListResponse,
} from '../../../interfaces';

@Injectable()
export class KiotVietMappingService {
  private readonly logger = new Logger(KiotVietMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kiotVietProductService: KiotVietProductService,
  ) {}

  /**
   * Map KiotViet product to Product entity
   */
  async getMappedKiotVietProducts(
    user: JwtPayload,
  ): Promise<KiotVietBaseMapping<KiotVietProductMapping>> {
    try {
      this.logger.log('Starting KiotViet products mapping process');

      // Step 1: Fetch all products from KiotViet using pagination
      const allKiotVietProducts = await this.fetchAllKiotVietProducts(user);
      this.logger.log(
        `Fetched ${allKiotVietProducts.length} products from KiotViet`,
      );

      // Step 2: Map KiotViet products to KiotVietProductMapping
      const mappedProducts = allKiotVietProducts.map((product) =>
        KiotVietProductMapping.fromKiotVietProduct(product),
      );
      this.logger.log(
        `Mapped ${mappedProducts.length} products to KiotVietProductMapping`,
      );

      // Step 3: Fetch all products from database for comparison
      const databaseProducts = await this.fetchDatabaseProducts();
      this.logger.log(
        `Fetched ${databaseProducts.length} products from database`,
      );

      // Step 4: Perform deep comparison using enhanced sync logic
      const groupedStats = this.calculateProductStats(
        mappedProducts,
        databaseProducts,
      );

      // Log comprehensive sync statistics including deletion count
      const totalStats = groupedStats.Product.totalStats;
      const totalProducts =
        totalStats.adds +
        totalStats.updates +
        totalStats.skips +
        totalStats.conflicts;
      const changePercentage =
        totalProducts > 0
          ? (
              ((totalStats.adds + totalStats.updates + totalStats.deletes) /
                totalProducts) *
              100
            ).toFixed(1)
          : '0';

      this.logger.log('='.repeat(80));
      this.logger.log('📊 KIOTVIET PRODUCT SYNC ANALYSIS COMPLETE');
      this.logger.log('='.repeat(80));
      this.logger.log(`📦 Total KiotViet Products: ${mappedProducts.length}`);
      this.logger.log(
        `🗄️  Total Database Products: ${databaseProducts.length}`,
      );
      this.logger.log('');
      this.logger.log('📈 SYNC STATISTICS:');
      this.logger.log(
        `   ✅ Products to ADD:     ${totalStats.adds.toString().padStart(6)} (new from KiotViet)`,
      );
      this.logger.log(
        `   🔄 Products to UPDATE:  ${totalStats.updates.toString().padStart(6)} (changes detected)`,
      );
      this.logger.log(
        `   ⏭️  Products to SKIP:    ${totalStats.skips.toString().padStart(6)} (no changes)`,
      );
      this.logger.log(
        `   ⚠️  Products CONFLICTS:  ${totalStats.conflicts.toString().padStart(6)} (data issues)`,
      );
      this.logger.log(
        `   🗑️  Products to DELETE:  ${totalStats.deletes.toString().padStart(6)} (removed from KiotViet)`,
      );
      this.logger.log('');
      this.logger.log(
        `📊 Impact: ${changePercentage}% of products will be modified`,
      );
      this.logger.log('='.repeat(80));

      return {
        data: mappedProducts,
        groupedStats,
      };
    } catch (error) {
      this.logger.error('Error in getMappedKiotVietProducts:', error);
      throw error;
    }
  }

  /**
   * Fetch all products from KiotViet using pagination
   */
  private async fetchAllKiotVietProducts(
    user: JwtPayload,
  ): Promise<KiotVietProductItem[]> {
    const allProducts: KiotVietProductItem[] = [];
    let currentItem = 0;
    const pageSize = 100;
    let hasMoreData = true;

    while (hasMoreData) {
      this.logger.log(
        `Fetching KiotViet products page: currentItem=${currentItem}, pageSize=${pageSize}`,
      );

      const paginationOptions: KiotVietPaginationOptions = {
        currentItem,
        pageSize,
        orderBy: 'id',
        orderDirection: 'asc',
      };

      try {
        const response: KiotVietApiListResponse<KiotVietProductItem> =
          await this.kiotVietProductService.getProducts(
            user,
            paginationOptions,
          );

        if (response.data && response.data.length > 0) {
          allProducts.push(...response.data);
          currentItem += response.data.length;

          // Check if we have more data to fetch
          // If we got fewer items than pageSize, we've reached the end
          hasMoreData = response.data.length === pageSize;

          this.logger.log(
            `Fetched ${response.data.length} products, total so far: ${allProducts.length}`,
          );
        } else {
          hasMoreData = false;
          this.logger.log('No more products to fetch');
        }
      } catch (error) {
        this.logger.error(
          `Error fetching products at currentItem ${currentItem}:`,
          error,
        );
        throw error;
      }

      // Add a small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return allProducts;
  }

  /**
   * Fetch all products from database for comparison
   */
  private async fetchDatabaseProducts() {
    try {
      const products = await this.prisma.product.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          price: true,
          basePrice: true,
          isActive: true,
          kiotVietProductId: true,
          slug: true,
          source: true,
          type: true,
          weight: true,
          minQuantity: true,
          maxQuantity: true,
          allowsSale: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return products;
    } catch (error) {
      this.logger.error('Error fetching database products:', error);
      throw error;
    }
  }

  /**
   * Calculate sync statistics for products using the sync-utils logic
   */
  private calculateProductStats(
    sourceData: KiotVietProductMapping[],
    targetData: any[],
  ): Record<
    string,
    {
      components: Array<{
        name: string;
        stats: SyncStats;
        displayName: string;
        detailBreakdown?: Array<{
          category: string;
          count: number;
          description: string;
        }>;
      }>;
      totalStats: SyncStats;
    }
  > {
    const stats = this.diffByIdAndFields(
      sourceData,
      targetData,
      (row: any) => row.kiotVietProductId || row.id || row.code,
      // Enhanced field list - not used directly in new implementation but kept for interface compatibility
      [
        'name',
        'code',
        'description',
        'barCode',
        'price',
        'basePrice',
        'minQuantity',
        'maxQuantity',
        'isActive',
        'allowsSale',
        'weight',
        'unit',
        'conversionValue',
        'taxRate',
        'taxRateDirect',
        'isLotSerialControl',
        'isBatchExpireControl',
        'isRewardPoint',
      ],
    );

    // Calculate detailed breakdown by categories or other criteria
    const categoryBreakdown = this.calculateCategoryBreakdown(
      sourceData,
      targetData,
    );

    return {
      Product: {
        components: [
          {
            name: 'Product',
            displayName: 'Sản phẩm',
            stats,
          },
        ],
        totalStats: stats,
      },
    };
  }

  /**
   * Enhanced deep comparison between KiotViet products and database products
   * Performs comprehensive field-by-field analysis with intelligent type handling
   */
  private diffByIdAndFields(
    sourceRows: KiotVietProductMapping[],
    targetRows: any[],
    idSelector: (row: any) => any,
    comparableFields: string[],
  ): SyncStats {
    const stats: SyncStats = {
      adds: 0,
      updates: 0,
      skips: 0,
      conflicts: 0,
      deletes: 0,
    };

    // Create comprehensive maps for both KiotViet ID and product code matching
    const targetByKiotVietId = new Map();
    const targetByCode = new Map();

    targetRows.forEach((row) => {
      // Map by KiotViet ID if available
      if (row.kiotVietProductId) {
        targetByKiotVietId.set(row.kiotVietProductId.toString(), row);
      }
      // Map by product code for fallback matching
      if (row.code) {
        targetByCode.set(row.code.toString(), row);
      }
    });

    // Process each KiotViet product
    sourceRows.forEach((sourceRow) => {
      const kiotVietId = sourceRow.kiotVietProductId?.toString();
      const productCode = sourceRow.code;

      // Find target product using multiple matching strategies
      let targetRow = null;
      let matchStrategy = '';

      // Strategy 1: Match by KiotViet ID (most reliable)
      if (kiotVietId && targetByKiotVietId.has(kiotVietId)) {
        targetRow = targetByKiotVietId.get(kiotVietId);
        matchStrategy = 'kiotVietId';
      }
      // Strategy 2: Match by product code (fallback)
      else if (productCode && targetByCode.has(productCode)) {
        targetRow = targetByCode.get(productCode);
        matchStrategy = 'code';
      }

      if (!targetRow) {
        // Product doesn't exist in database - will be added
        stats.adds++;
        this.logger.debug(
          `Product ${sourceRow.name} (${sourceRow.code}) will be ADDED`,
        );
      } else {
        // Product exists - perform deep comparison
        const comparisonResult = this.performDeepProductComparison(
          sourceRow,
          targetRow,
        );

        if (comparisonResult.hasConflicts) {
          stats.conflicts++;
          this.logger.debug(
            `Product ${sourceRow.name} (${sourceRow.code}) has CONFLICTS: ${comparisonResult.conflictReasons.join(', ')}`,
          );
        } else if (comparisonResult.hasChanges) {
          stats.updates++;
          this.logger.debug(
            `Product ${sourceRow.name} (${sourceRow.code}) will be UPDATED (${matchStrategy}): ${comparisonResult.changedFields.join(', ')}`,
          );
        } else {
          stats.skips++;
          this.logger.debug(
            `Product ${sourceRow.name} (${sourceRow.code}) will be SKIPPED (no changes)`,
          );
        }
      }
    });

    // Calculate deletions: database products from KiotViet that are no longer in source
    const kiotVietSourceIds = new Set(
      sourceRows
        .map((row) => row.kiotVietProductId?.toString())
        .filter(Boolean),
    );

    targetRows.forEach((targetRow) => {
      // Only consider products that originally came from KiotViet
      // Check both source field and presence of kiotVietProductId
      const isFromKiotViet =
        targetRow.kiotVietProductId &&
        (targetRow.source === 'kiotviet' || targetRow.source === 'KIOTVIET');

      if (isFromKiotViet) {
        const targetKiotVietId = targetRow.kiotVietProductId.toString();

        // If this KiotViet product is no longer in the source data, it will be deleted
        if (!kiotVietSourceIds.has(targetKiotVietId)) {
          stats.deletes++;
          this.logger.debug(
            `Product ${targetRow.name} (${targetRow.code}) will be DELETED (KiotViet ID: ${targetKiotVietId} no longer exists)`,
          );
        }
      }
    });

    return stats;
  }

  /**
   * Perform deep comparison between a KiotViet product and database product
   * Returns detailed analysis of changes, conflicts, and affected fields
   */
  private performDeepProductComparison(
    kiotVietProduct: KiotVietProductMapping,
    databaseProduct: any,
  ): {
    hasChanges: boolean;
    hasConflicts: boolean;
    changedFields: string[];
    conflictReasons: string[];
  } {
    const result = {
      hasChanges: false,
      hasConflicts: false,
      changedFields: [] as string[],
      conflictReasons: [] as string[],
    };

    // Define critical fields that must not be null/undefined
    const criticalFields = ['name', 'code'];

    // Define fields to compare with their comparison strategies
    const fieldComparisons = [
      // Basic product information
      { field: 'name', type: 'string', critical: true },
      { field: 'code', type: 'string', critical: true },
      { field: 'description', type: 'string', allowNull: true },
      { field: 'barCode', type: 'string', allowNull: true },

      // Pricing and inventory
      { field: 'price', type: 'decimal', tolerance: 0.01 },
      { field: 'basePrice', type: 'decimal', tolerance: 0.01 },
      { field: 'minQuantity', type: 'number' },
      { field: 'maxQuantity', type: 'number', allowNull: true },

      // Status fields
      { field: 'isActive', type: 'boolean' },
      { field: 'allowsSale', type: 'boolean' },

      // Physical properties
      { field: 'weight', type: 'number', allowNull: true, tolerance: 0.001 },
      { field: 'unit', type: 'string' },
      { field: 'conversionValue', type: 'decimal', tolerance: 0.01 },

      // Tax information
      { field: 'taxRate', type: 'string', allowNull: true },
      {
        field: 'taxRateDirect',
        type: 'number',
        allowNull: true,
        tolerance: 0.01,
      },

      // Control flags
      { field: 'isLotSerialControl', type: 'boolean' },
      { field: 'isBatchExpireControl', type: 'boolean' },
      { field: 'isRewardPoint', type: 'boolean' },
    ];

    // Perform field-by-field comparison
    for (const comparison of fieldComparisons) {
      const { field, type, critical, allowNull, tolerance } = comparison;

      const sourceValue = kiotVietProduct[field];
      const targetValue = databaseProduct[field];

      // Check for critical field conflicts
      if (
        critical &&
        (sourceValue === null ||
          sourceValue === undefined ||
          sourceValue === '')
      ) {
        result.hasConflicts = true;
        result.conflictReasons.push(`Missing critical field: ${field}`);
        continue;
      }

      // Check for changes based on field type
      let hasFieldChange = false;

      switch (type) {
        case 'string':
          hasFieldChange = this.compareStringValues(
            sourceValue,
            targetValue,
            allowNull,
          );
          break;
        case 'number':
          hasFieldChange = this.compareNumericValues(
            sourceValue,
            targetValue,
            tolerance,
            allowNull,
          );
          break;
        case 'decimal':
          hasFieldChange = this.compareDecimalValues(
            sourceValue,
            targetValue,
            tolerance,
            allowNull,
          );
          break;
        case 'boolean':
          hasFieldChange = this.compareBooleanValues(sourceValue, targetValue);
          break;
        default:
          hasFieldChange = sourceValue !== targetValue;
      }

      if (hasFieldChange) {
        result.hasChanges = true;
        result.changedFields.push(`${field}: ${targetValue} → ${sourceValue}`);
      }
    }

    // Special comparison for category and business relationships
    if (kiotVietProduct.categoryId !== databaseProduct.categoryId) {
      result.hasChanges = true;
      result.changedFields.push(
        `categoryId: ${databaseProduct.categoryId} → ${kiotVietProduct.categoryId}`,
      );
    }

    if (kiotVietProduct.businessId !== databaseProduct.businessId) {
      result.hasChanges = true;
      result.changedFields.push(
        `businessId: ${databaseProduct.businessId} → ${kiotVietProduct.businessId}`,
      );
    }

    return result;
  }

  /**
   * Compare string values with null handling
   */
  private compareStringValues(
    sourceValue: any,
    targetValue: any,
    allowNull = false,
  ): boolean {
    // Normalize null/undefined/empty string values
    const normalizeString = (val: any) => {
      if (val === null || val === undefined) return allowNull ? null : '';
      return String(val).trim();
    };

    const normalizedSource = normalizeString(sourceValue);
    const normalizedTarget = normalizeString(targetValue);

    return normalizedSource !== normalizedTarget;
  }

  /**
   * Compare numeric values with tolerance
   */
  private compareNumericValues(
    sourceValue: any,
    targetValue: any,
    tolerance = 0,
    allowNull = false,
  ): boolean {
    // Handle null values
    if (
      (sourceValue === null || sourceValue === undefined) &&
      (targetValue === null || targetValue === undefined)
    ) {
      return false; // Both null, no change
    }

    if (
      sourceValue === null ||
      sourceValue === undefined ||
      targetValue === null ||
      targetValue === undefined
    ) {
      return !allowNull; // One is null, the other isn't
    }

    const numSource = Number(sourceValue);
    const numTarget = Number(targetValue);

    if (isNaN(numSource) || isNaN(numTarget)) {
      return true; // Invalid numbers are considered different
    }

    return Math.abs(numSource - numTarget) > tolerance;
  }

  /**
   * Compare decimal values (prices, etc.) with precision tolerance
   */
  private compareDecimalValues(
    sourceValue: any,
    targetValue: any,
    tolerance = 0.01,
    allowNull = false,
  ): boolean {
    return this.compareNumericValues(
      sourceValue,
      targetValue,
      tolerance,
      allowNull,
    );
  }

  /**
   * Compare boolean values with type coercion
   */
  private compareBooleanValues(sourceValue: any, targetValue: any): boolean {
    const normalizeBool = (val: any) => {
      if (val === null || val === undefined) return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      if (typeof val === 'number') return val !== 0;
      return Boolean(val);
    };

    return normalizeBool(sourceValue) !== normalizeBool(targetValue);
  }

  /**
   * Calculate detailed breakdown by categories for hover tooltips
   */
  private calculateCategoryBreakdown(
    sourceData: KiotVietProductMapping[],
    targetData: any[],
  ): Array<{ category: string; count: number; description: string }> {
    // Group products by category
    const categoryGroups: Record<string, KiotVietProductMapping[]> = {};

    sourceData.forEach((product) => {
      const category = product.categoryName || 'Không có danh mục';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(product);
    });

    // Calculate stats for each category
    const breakdown = Object.entries(categoryGroups).map(
      ([category, products]) => {
        const categoryStats = this.diffByIdAndFields(
          products,
          targetData,
          (row: any) => row.kiotVietProductId || row.id || row.code,
          // Using same enhanced field list for consistency
          [
            'name',
            'code',
            'description',
            'barCode',
            'price',
            'basePrice',
            'minQuantity',
            'maxQuantity',
            'isActive',
            'allowsSale',
            'weight',
            'unit',
            'conversionValue',
            'taxRate',
            'taxRateDirect',
            'isLotSerialControl',
            'isBatchExpireControl',
            'isRewardPoint',
          ],
        );

        return {
          category,
          count: categoryStats.adds,
          description: `${categoryStats.adds} sản phẩm mới sẽ được thêm từ danh mục ${category}`,
        };
      },
    );

    // Sort by count descending
    return breakdown.sort((a, b) => b.count - a.count);
  }
}
