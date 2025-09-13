import { Injectable, Logger } from '@nestjs/common';
import { SyncDirection, SyncEntityType, SyncStatus } from '@prisma/client';
import { JwtPayload } from '../../../../../auth/jwt-payload';
import { PrismaService } from '../../../../../common/services/prisma.service';
import { KiotVietProductItem } from '../../../../interfaces/kiotviet.product.interface';
import { KiotVietPaginationOptions } from '../../../../interfaces/kiotviet.common.interface';
import { KiotVietProductService } from '../../kiot-viet.product.service';
import { KiotVietMappingService } from '../../kiotviet-mapping/kiotviet-mapping.product.service';
import {
  KiotVietSyncLogService,
  SyncLogDetails,
} from '../../kiotviet-sync-log.service';
import { KiotVietSyncingHelpersService } from '../kiotviet-syncing-helpers.service';
import { KiotVietProductMappingHelper } from './kiotviet-product-mapping.helper';
import { KiotVietProductRelationshipsHelper } from './kiotviet-product-relationships.helper';
import { KiotVietWarehouseHelper } from './kiotviet-warehouse.helper';

@Injectable()
export class KiotVietProductSyncService {
  private readonly logger = new Logger(KiotVietProductSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kiotVietProductService: KiotVietProductService,
    private readonly syncLogService: KiotVietSyncLogService,
    private readonly mappingService: KiotVietMappingService,
    private readonly helpersService: KiotVietSyncingHelpersService,
    private readonly mappingHelper: KiotVietProductMappingHelper,
    private readonly relationshipsHelper: KiotVietProductRelationshipsHelper,
    private readonly warehouseHelper: KiotVietWarehouseHelper,
  ) {}

  /**
   * Main method to sync KiotViet products to ACTA
   */
  async syncKiotVietProductsToActa(user: JwtPayload) {
    const startTime = new Date();
    let syncLogId: string | undefined;

    try {
      this.logger.log('Starting KiotViet products sync to ACTA');

      // Step 1: First get raw products to extract entities for dependencies
      this.logger.debug(
        'Fetching raw KiotViet products for entity extraction...',
      );
      const rawProducts = await this.fetchAllKiotVietProducts(user);

      // Extract unique entities from raw products (they have complete data)
      const { uniqueCategories, uniqueTradeMarks, uniqueBranches } =
        this.extractUniqueEntitiesFromRaw(rawProducts);

      this.logger.log(
        `Found ${uniqueCategories.length} categories, ${uniqueTradeMarks.length} trademarks, ${uniqueBranches.length} branches`,
      );

      // Step 2: Get mapped products for actual syncing
      const mappingResult =
        await this.mappingService.getMappedKiotVietProducts(user);
      const { data: mappedProducts } = mappingResult;

      // Start sync log
      syncLogId = await this.syncLogService.startSyncLog(
        SyncDirection.KIOTVIET_TO_ACTA,
        SyncEntityType.PRODUCT,
        mappedProducts.length,
      );

      const syncDetails = this.initializeSyncDetails(mappedProducts.length);

      // Validate that we have required data
      this.validateRequiredData(uniqueCategories, uniqueTradeMarks);

      // Step 3: Process sync in a transaction
      await this.processSyncTransaction(
        user,
        mappedProducts,
        uniqueCategories,
        uniqueTradeMarks,
        uniqueBranches,
        syncDetails,
      );

      // Complete sync log
      await this.syncLogService.completeSyncLog(
        syncLogId,
        SyncStatus.SUCCESS,
        syncDetails,
      );

      const endTime = new Date();
      this.logger.log(
        `KiotViet products sync completed successfully in ${endTime.getTime() - startTime.getTime()}ms`,
      );

      return {
        success: true,
        syncLogId,
        details: syncDetails,
      };
    } catch (error) {
      this.logger.error('Error syncing KiotViet products to ACTA:', error);

      if (syncLogId) {
        const errorSyncDetails = this.initializeSyncDetails(0);
        errorSyncDetails.errorDetails = [error.message];
        await this.syncLogService.completeSyncLog(
          syncLogId,
          SyncStatus.FAILED,
          errorSyncDetails,
        );
      }

      throw error;
    }
  }

  /**
   * Initialize sync details with default statistics
   */
  private initializeSyncDetails(totalRecords: number): SyncLogDetails {
    const createEmptyStats = () => ({
      adds: 0,
      updates: 0,
      skips: 0,
      conflicts: 0,
      deletes: 0,
      errors: 0,
    });

    return {
      totalRecords,
      successCount: 0,
      failedCount: 0,
      errorDetails: [],
      categoryStats: createEmptyStats(),
      businessStats: createEmptyStats(),
      warehouseStats: createEmptyStats(),
      productStats: createEmptyStats(),
      userStats: createEmptyStats(),
      productImageStats: createEmptyStats(),
      productInventoryStats: createEmptyStats(),
      productAttributeStats: createEmptyStats(),
      productUnitStats: createEmptyStats(),
      productPriceBookStats: createEmptyStats(),
      productFormulaStats: createEmptyStats(),
      productSerialStats: createEmptyStats(),
      productBatchExpireStats: createEmptyStats(),
      productWarrantyStats: createEmptyStats(),
      productShelfStats: createEmptyStats(),
    };
  }

  /**
   * Extract unique entities from mapped products
   */
  private extractUniqueEntities(mappedProducts: any[]) {
    return {
      uniqueCategories:
        this.mappingHelper.extractUniqueCategories(mappedProducts),
      uniqueTradeMarks:
        this.mappingHelper.extractUniqueTradeMarks(mappedProducts),
      uniqueBranches: this.mappingHelper.extractUniqueBranches(mappedProducts),
    };
  }

  /**
   * Validate required data for sync
   */
  private validateRequiredData(
    uniqueCategories: any[],
    uniqueTradeMarks: any[],
  ): void {
    if (uniqueCategories.length === 0) {
      throw new Error(
        'No categories found in products - cannot proceed with sync',
      );
    }
    if (uniqueTradeMarks.length === 0) {
      throw new Error(
        'No trademarks/businesses found in products - cannot proceed with sync',
      );
    }
  }

  /**
   * Process the entire sync with separate transactions for dependencies and products
   */
  private async processSyncTransaction(
    user: JwtPayload,
    mappedProducts: any[],
    uniqueCategories: any[],
    uniqueTradeMarks: any[],
    uniqueBranches: any[],
    syncDetails: SyncLogDetails,
  ): Promise<void> {
    // First, create dependencies in a separate transaction
    const { categoryMap, businessMap, warehouseMap } =
      await this.prisma.$transaction(
        async (tx) => {
          // Create dependencies
          const deps = await this.createDependencies(
            tx,
            uniqueCategories,
            uniqueTradeMarks,
            uniqueBranches,
            syncDetails,
          );

          // Validate dependencies were created
          this.validateDependencies(
            deps.categoryMap,
            deps.businessMap,
            uniqueCategories,
            uniqueTradeMarks,
          );

          return deps;
        },
        {
          timeout: 60000, // 1 minute timeout for dependencies
        },
      );

    // Then, sync products individually to avoid transaction rollback on individual failures
    await this.syncProductsIndividually(
      user,
      mappedProducts,
      categoryMap,
      businessMap,
      warehouseMap,
      syncDetails,
    );

    // Calculate final statistics
    this.calculateFinalStatistics(syncDetails);
  }

  /**
   * Create all dependencies (categories, businesses, warehouses)
   */
  private async createDependencies(
    tx: any,
    uniqueCategories: any[],
    uniqueTradeMarks: any[],
    uniqueBranches: any[],
    syncDetails: SyncLogDetails,
  ) {
    // Create categories
    const categoryMap = await this.helpersService.createCategories(
      tx,
      uniqueCategories,
      syncDetails.categoryStats!,
    );

    // Create users for businesses
    const userMap = await this.helpersService.createUsersForBusinesses(
      tx,
      uniqueTradeMarks,
      syncDetails.userStats!,
    );

    // Create businesses
    const businessMap = await this.helpersService.createBusinesses(
      tx,
      uniqueTradeMarks,
      userMap,
      syncDetails.businessStats!,
    );

    // Create warehouses
    const warehouseMap = await this.helpersService.createWarehouses(
      tx,
      uniqueBranches,
      syncDetails.warehouseStats!,
    );

    return { categoryMap, businessMap, warehouseMap };
  }

  /**
   * Validate that dependencies were created successfully
   */
  private validateDependencies(
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    uniqueCategories: any[],
    uniqueTradeMarks: any[],
  ): void {
    if (categoryMap.size === 0 && uniqueCategories.length > 0) {
      throw new Error(
        'Failed to create/find any categories - cannot proceed with product creation',
      );
    }
    if (businessMap.size === 0 && uniqueTradeMarks.length > 0) {
      throw new Error(
        'Failed to create/find any businesses - cannot proceed with product creation',
      );
    }

    this.logger.log(
      `Dependencies ready: ${categoryMap.size} categories, ${businessMap.size} businesses`,
    );
  }

  /**
   * Sync products individually to avoid transaction rollback on individual failures
   */
  private async syncProductsIndividually(
    user: JwtPayload,
    mappedProducts: any[],
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    syncDetails: SyncLogDetails,
  ): Promise<void> {
    this.logger.log(
      `Starting individual sync for ${mappedProducts.length} products`,
    );

    for (const mappedProduct of mappedProducts) {
      try {
        // Fetch detailed product information from KiotViet
        let detailedProduct: KiotVietProductItem;
        try {
          detailedProduct = await this.kiotVietProductService.getProductById(
            user,
            mappedProduct.kiotVietProductId.toString(),
          );
        } catch (detailError: any) {
          // Handle 400 errors for inventory not found - treat as empty inventories
          if (
            detailError?.response?.status === 400 &&
            detailError?.response?.data?.message?.includes(
              'Không tìm thấy tồn kho',
            )
          ) {
            this.logger.warn(
              `Inventory not found for product ${mappedProduct.code}, treating as empty inventories: ${detailError.response.data.message}`,
            );

            // Create a minimal product object with empty inventories
            detailedProduct = {
              ...mappedProduct,
              inventories: [],
              images: [],
              attributes: [],
              units: [],
              priceBooks: [],
              productFormulas: [],
              serials: [],
              productBatchExpires: [],
              productWarranties: [],
              productShelves: [],
            } as KiotVietProductItem;

            // Increment inventory error stats
            syncDetails.productInventoryStats!.errors++;
          } else {
            // Re-throw other errors
            throw detailError;
          }
        }

        this.logger.debug(
          `Fetched detailed info for product ${detailedProduct.code}`,
        );

        // Process each product in its own transaction to avoid rollback on individual failures
        try {
          await this.prisma.$transaction(
            async (tx) => {
              // Sync warehouses from product inventories if they don't exist
              await this.warehouseHelper.syncWarehousesFromInventories(
                tx,
                detailedProduct.inventories,
                warehouseMap,
                syncDetails.warehouseStats!,
              );

              // Create or update the product with all its relationships
              await this.createProductWithRelationships(
                tx,
                detailedProduct,
                categoryMap,
                businessMap,
                warehouseMap,
                syncDetails,
              );
            },
            {
              timeout: 30000, // 30 seconds timeout per product
            },
          );
        } catch (transactionError) {
          // If transaction fails, try to create product without warehouses first
          this.logger.warn(
            `Transaction failed for product ${detailedProduct.code}, trying simplified approach:`,
            transactionError,
          );

          try {
            await this.prisma.$transaction(
              async (tx) => {
                // Create or update the product with all its relationships (skip warehouses)
                await this.createProductWithRelationships(
                  tx,
                  detailedProduct,
                  categoryMap,
                  businessMap,
                  warehouseMap,
                  syncDetails,
                );
              },
              {
                timeout: 30000, // 30 seconds timeout per product
              },
            );
          } catch (simplifiedError) {
            throw simplifiedError; // Re-throw if even simplified approach fails
          }
        }

        // Note: adds/updates are handled in createProductWithRelationships
        this.logger.debug(
          `Successfully synced product ${detailedProduct.code}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product ${mappedProduct.code}:`,
          error,
        );

        // Handle specific Prisma validation errors
        if (
          error.code === 'P2000' ||
          error.message?.includes('Invalid value for argument')
        ) {
          this.logger.error(
            `Data validation error for product ${mappedProduct.code}:`,
            {
              productId: mappedProduct.kiotVietProductId,
              error: error.message,
              code: mappedProduct.code,
            },
          );
        }

        syncDetails.productStats!.errors++;
        syncDetails.errorDetails!.push(
          `Product ${mappedProduct.kiotVietProductId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Completed individual product sync: ${syncDetails.productStats!.adds} successful, ${syncDetails.productStats!.errors} failed`,
    );
  }

  /**
   * Sync products with detailed information fetched individually from KiotViet
   */
  private async syncProductsWithDetailedInfo(
    tx: any,
    user: JwtPayload,
    mappedProducts: any[],
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    syncDetails: SyncLogDetails,
  ): Promise<void> {
    this.logger.log(
      `Starting detailed product sync for ${mappedProducts.length} products`,
    );

    for (const mappedProduct of mappedProducts) {
      try {
        // Fetch detailed product information from KiotViet
        const detailedProduct =
          await this.kiotVietProductService.getProductById(
            user,
            mappedProduct.kiotVietProductId.toString(),
          );

        this.logger.debug(
          `Fetched detailed info for product ${detailedProduct.code}`,
        );

        // Sync warehouses from product inventories if they don't exist
        await this.warehouseHelper.syncWarehousesFromInventories(
          tx,
          detailedProduct.inventories,
          warehouseMap,
          syncDetails.warehouseStats!,
        );

        // Create or update the product with all its relationships
        await this.createProductWithRelationships(
          tx,
          detailedProduct,
          categoryMap,
          businessMap,
          warehouseMap,
          syncDetails,
        );

        syncDetails.productStats!.adds++;
        this.logger.debug(
          `Successfully synced product ${detailedProduct.code}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product ${mappedProduct.code}:`,
          error,
        );

        // Handle specific Prisma validation errors
        if (
          error.code === 'P2000' ||
          error.message?.includes('Invalid value for argument')
        ) {
          this.logger.error(
            `Data validation error for product ${mappedProduct.code}:`,
            {
              productId: mappedProduct.kiotVietProductId,
              error: error.message,
              code: mappedProduct.code,
            },
          );
        }

        syncDetails.productStats!.errors++;
        syncDetails.errorDetails!.push(
          `Product ${mappedProduct.kiotVietProductId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Completed detailed product sync: ${syncDetails.productStats!.adds} successful, ${syncDetails.productStats!.errors} failed`,
    );
  }

  /**
   * Create product with all its relationships
   */
  private async createProductWithRelationships(
    tx: any,
    detailedProduct: KiotVietProductItem,
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    syncDetails: SyncLogDetails,
  ): Promise<void> {
    // Validate required data
    if (!detailedProduct || !detailedProduct.code) {
      throw new Error('Invalid product data: missing code');
    }

    if (!detailedProduct.categoryId || !detailedProduct.tradeMarkId) {
      throw new Error(
        `Missing required relationships for product ${detailedProduct.code}: categoryId=${detailedProduct.categoryId}, tradeMarkId=${detailedProduct.tradeMarkId}`,
      );
    }

    // Get required IDs
    const categoryId = categoryMap.get(detailedProduct.categoryId);
    const businessId = businessMap.get(detailedProduct.tradeMarkId);

    if (!categoryId || !businessId) {
      throw new Error(
        `Missing required relationships for product ${detailedProduct.code}: categoryId=${categoryId}, businessId=${businessId}`,
      );
    }

    // Check if product already exists
    const existingProduct = await tx.product.findFirst({
      where: {
        OR: [
          { kiotVietProductId: detailedProduct.id },
          { code: detailedProduct.code },
        ],
      },
    });

    let productId: string;

    if (existingProduct) {
      // Update existing product
      await tx.product.update({
        where: { id: existingProduct.id },
        data: {
          ...this.mappingHelper.buildProductData(
            detailedProduct,
            categoryId,
            businessId,
          ),
          updatedAt: new Date(),
        },
      });
      productId = existingProduct.id;
      syncDetails.productStats!.updates++;
    } else {
      // Create new product
      const newProduct = await tx.product.create({
        data: this.mappingHelper.buildProductData(
          detailedProduct,
          categoryId,
          businessId,
        ),
      });
      productId = newProduct.id;
      syncDetails.productStats!.adds++;
    }

    // Sync all product relationships
    await this.relationshipsHelper.syncProductRelationships(
      tx,
      productId,
      detailedProduct,
      warehouseMap,
      syncDetails,
    );
  }

  /**
   * Calculate final statistics
   */
  private calculateFinalStatistics(syncDetails: SyncLogDetails): void {
    const totalProductAttempts =
      syncDetails.productStats!.adds +
      syncDetails.productStats!.skips +
      syncDetails.productStats!.conflicts +
      syncDetails.productStats!.errors;

    const successfulProducts =
      syncDetails.productStats!.adds + syncDetails.productStats!.skips;
    const failedProducts =
      syncDetails.productStats!.errors + syncDetails.productStats!.conflicts;
    const failureRate =
      totalProductAttempts > 0 ? failedProducts / totalProductAttempts : 0;

    // Log warning if failure rate is high, but don't rollback since we handle individual failures
    if (failureRate > 0.5 && totalProductAttempts > 0) {
      this.logger.warn(
        `High product failure rate: ${Math.round(failureRate * 100)}% (${failedProducts}/${totalProductAttempts}) - check error logs for details`,
      );
    }

    syncDetails.successCount = successfulProducts;
    syncDetails.failedCount = failedProducts;

    this.logger.log(
      `Sync completed: ${syncDetails.successCount}/${totalProductAttempts} products processed successfully (failure rate: ${Math.round(failureRate * 100)}%)`,
    );
  }

  /**
   * Fetch all products from KiotViet
   */
  private async fetchAllKiotVietProducts(user: JwtPayload) {
    const allProducts: KiotVietProductItem[] = [];
    let currentItem = 0;
    const pageSize = 100;
    let hasMoreData = true;

    while (hasMoreData) {
      this.logger.debug(
        `Fetching KiotViet products page: currentItem=${currentItem}, pageSize=${pageSize}`,
      );

      const paginationOptions: KiotVietPaginationOptions = {
        currentItem,
        pageSize,
        orderBy: 'id',
        orderDirection: 'asc' as const,
      };

      try {
        const response = await this.kiotVietProductService.getProducts(
          user,
          paginationOptions,
        );

        if (response.data && response.data.length > 0) {
          allProducts.push(...response.data);
          currentItem += response.data.length;

          if (response.data.length < pageSize) {
            hasMoreData = false;
          }
        } else {
          hasMoreData = false;
        }
      } catch (error) {
        this.logger.error('Error fetching KiotViet products page:', error);
        throw error;
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return allProducts;
  }

  /**
   * Extract unique entities from raw KiotViet products
   */
  private extractUniqueEntitiesFromRaw(rawProducts: KiotVietProductItem[]) {
    return {
      uniqueCategories: this.mappingHelper.extractUniqueCategories(rawProducts),
      uniqueTradeMarks: this.mappingHelper.extractUniqueTradeMarks(rawProducts),
      uniqueBranches: this.mappingHelper.extractUniqueBranches(rawProducts),
    };
  }
}
