import { Injectable, Logger } from '@nestjs/common';
import { SyncDirection, SyncEntityType, SyncStatus } from '@prisma/client';
import { JwtPayload } from '../../../../../auth/jwt-payload';
import { PrismaService } from '../../../../../common/services/prisma.service';
import { KiotVietProductItem } from '../../../../interfaces/kiotviet.product.interface';
import { KiotVietProductUtil } from '../../../utils/kiotviet-product.util';
import { KiotVietProductService } from '../../kiot-viet.product.service';
import { KiotVietMappingService } from '../../kiotviet-mapping/kiotviet-mapping.product.service';
import {
  KiotVietSyncLogService,
  SyncLogDetails,
} from '../../kiotviet-sync-log.service';
import { KiotVietProductCrudService } from './kiotviet-product-crud.service';
import { KiotVietSyncingHelpersService } from '../kiotviet-syncing-helpers.service';

@Injectable()
export class KiotVietProductSyncingService {
  private readonly logger = new Logger(KiotVietProductSyncingService.name);
  private readonly firstPositionProfile = 11000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kiotVietProductService: KiotVietProductService,
    private readonly syncLogService: KiotVietSyncLogService,
    private readonly productUtil: KiotVietProductUtil,
    private readonly mappingService: KiotVietMappingService,
    private readonly helpersService: KiotVietSyncingHelpersService,
    private readonly productCrudService: KiotVietProductCrudService,
  ) {}

  async syncKiotVietProductsToActa(user: JwtPayload) {
    const startTime = new Date();
    let syncLogId: string;

    try {
      this.logger.log('Starting KiotViet products sync to ACTA');

      // Step 1: Get mapped products using the existing mapping service
      const mappingResult =
        await this.mappingService.getMappedKiotVietProducts(user);
      const { data: mappedProducts } = mappingResult;

      // Start sync log
      syncLogId = await this.syncLogService.startSyncLog(
        SyncDirection.KIOTVIET_TO_ACTA,
        SyncEntityType.PRODUCT,
        mappedProducts.length,
      );

      const syncDetails: SyncLogDetails = {
        totalRecords: mappedProducts.length,
        successCount: 0,
        failedCount: 0,
        errorDetails: [],
        categoryStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        businessStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        warehouseStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        userStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        // Initialize new product relationship statistics
        productImageStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productInventoryStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productAttributeStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productUnitStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productPriceBookStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productFormulaStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productSerialStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productBatchExpireStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productWarrantyStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productShelfStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productVariantStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productOrderTemplateStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
      };

      // Step 2: Pre-validate that we have data to process
      const uniqueCategories = this.getUniqueCategories(mappedProducts);
      const uniqueTradeMarks = this.getUniqueTradeMarks(mappedProducts);
      const uniqueBranches = this.getUniqueBranches(mappedProducts);

      this.logger.log(
        `Found ${uniqueCategories.length} categories, ${uniqueTradeMarks.length} trademarks, ${uniqueBranches.length} branches`,
      );

      // Validate that we have required data
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

      this.logger.debug(
        'Categories to process:',
        uniqueCategories.map((c) => `${c.id}: ${c.name}`),
      );
      this.logger.debug(
        'Trademarks to process:',
        uniqueTradeMarks.map((t) => `${t.id}: ${t.name}`),
      );

      // Step 3: Process sync in a transaction (all or nothing)
      await this.prisma.$transaction(
        async (tx) => {
          // Step 3: Create categories
          const categoryMap = await this.helpersService.createCategories(
            tx,
            uniqueCategories,
            syncDetails.categoryStats!,
          );

          // Step 4: Use extracted trademarks (now we should have trademarks)
          const tradeMarksToProcess = uniqueTradeMarks;

          // Create users for businesses
          const userMap = await this.helpersService.createUsersForBusinesses(
            tx,
            tradeMarksToProcess,
            syncDetails.userStats!,
          );

          // Step 5: Create businesses from trademarks
          const businessMap = await this.helpersService.createBusinesses(
            tx,
            tradeMarksToProcess,
            userMap,
            syncDetails.businessStats!,
          );

          // Step 6: Create warehouses from branches
          const warehouseMap = await this.helpersService.createWarehouses(
            tx,
            uniqueBranches,
            syncDetails.warehouseStats!,
          );

          // Step 7: Validate and fix existing products with incorrect relationships
          this.logger.log(
            'Validating and fixing existing product relationships...',
          );
          await this.helpersService.validateAndFixExistingProducts(
            tx,
            mappedProducts,
            categoryMap,
            businessMap,
            syncDetails,
          );

          // Validate that required dependencies were created/found
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
            `Dependencies ready: ${categoryMap.size} categories, ${businessMap.size} businesses, ${warehouseMap.size} warehouses`,
          );

          // Step 7: Create products with detailed information
          await this.syncProductsWithDetailedInfo(
            tx,
            user,
            mappedProducts,
            categoryMap,
            businessMap,
            warehouseMap,
            syncDetails,
          );

          // Calculate success count based on actual product creation stats
          const totalProductAttempts =
            syncDetails.productStats!.adds +
            syncDetails.productStats!.skips +
            syncDetails.productStats!.conflicts +
            syncDetails.productStats!.errors;

          const successfulProducts =
            syncDetails.productStats!.adds + syncDetails.productStats!.skips;
          const failedProducts =
            syncDetails.productStats!.errors +
            syncDetails.productStats!.conflicts;
          const failureRate =
            totalProductAttempts > 0
              ? failedProducts / totalProductAttempts
              : 0;

          // If more than 80% of products failed, rollback the transaction
          if (failureRate > 0.8 && totalProductAttempts > 0) {
            throw new Error(
              `Product creation failure rate too high: ${Math.round(failureRate * 100)}% (${failedProducts}/${totalProductAttempts}) - rolling back transaction`,
            );
          }

          syncDetails.successCount = successfulProducts;
          syncDetails.failedCount = failedProducts;

          this.logger.log(
            `Sync completed: ${syncDetails.successCount}/${totalProductAttempts} products processed successfully (failure rate: ${Math.round(failureRate * 100)}%)`,
          );
        },
        {
          timeout: 300000, // 5 minutes timeout
        },
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
        duration: endTime.getTime() - startTime.getTime(),
      };
    } catch (error) {
      this.logger.error('Error during KiotViet products sync:', error);

      const syncDetails: SyncLogDetails = {
        totalRecords: 0,
        successCount: 0,
        failedCount: 1,
        errorDetails: [error.message],
      };

      if (syncLogId!) {
        await this.syncLogService.completeSyncLog(
          syncLogId,
          SyncStatus.FAILED,
          syncDetails,
        );
      }

      throw error;
    }
  }

  /**
   * Enhanced product sync with CREATE, UPDATE, DELETE operations
   * This method fetches fresh data from KiotViet API and uses CRUD operations
   */
  async syncKiotVietProductsCrud(user: JwtPayload): Promise<any> {
    const startTime = new Date();
    let syncLogId: string;

    try {
      this.logger.log('Starting enhanced KiotViet products CRUD sync to ACTA');

      // Step 1: Fetch fresh data from KiotViet API
      const allKiotVietProducts = await this.fetchAllKiotVietProducts(user);
      const removeIds = await this.fetchRemovedProductIds(user);

      this.logger.log(
        `Fetched ${allKiotVietProducts.length} products and ${removeIds?.length || 0} removal IDs from KiotViet`,
      );

      // Start sync log
      syncLogId = await this.syncLogService.startSyncLog(
        SyncDirection.KIOTVIET_TO_ACTA,
        SyncEntityType.PRODUCT,
        allKiotVietProducts.length,
      );

      // Step 2: Process sync in a transaction to ensure entity creation and product CRUD are atomic
      const crudResult = await this.prisma.$transaction(
        async (tx) => {
          // Extract unique entities from products
          const uniqueCategories =
            this.getUniqueCategories(allKiotVietProducts);
          const uniqueTradeMarks =
            this.getUniqueTradeMarks(allKiotVietProducts);
          const uniqueBranches = this.getUniqueBranches(allKiotVietProducts);

          this.logger.log(
            `Creating mappings - Categories: ${uniqueCategories.length}, Trademarks: ${uniqueTradeMarks.length}, Branches: ${uniqueBranches.length}`,
          );

          // Create categories within transaction
          const categoryMap = await this.helpersService.createCategories(
            tx,
            uniqueCategories,
            {
              adds: 0,
              updates: 0,
              skips: 0,
              conflicts: 0,
              deletes: 0,
              errors: 0,
            },
          );

          // Create users for businesses within transaction
          const userMap = await this.helpersService.createUsersForBusinesses(
            tx,
            uniqueTradeMarks,
            {
              adds: 0,
              updates: 0,
              skips: 0,
              conflicts: 0,
              deletes: 0,
              errors: 0,
            },
          );

          // Create businesses within transaction with proper user mapping
          const businessMap = await this.helpersService.createBusinesses(
            tx,
            uniqueTradeMarks,
            userMap,
            {
              adds: 0,
              updates: 0,
              skips: 0,
              conflicts: 0,
              deletes: 0,
              errors: 0,
            },
          );

          // Create warehouses within transaction
          const warehouseMap = await this.helpersService.createWarehouses(
            tx,
            uniqueBranches,
            {
              adds: 0,
              updates: 0,
              skips: 0,
              conflicts: 0,
              deletes: 0,
              errors: 0,
            },
          );

          this.logger.log(
            `Created mappings - Categories: ${categoryMap.size}, Businesses: ${businessMap.size}, Warehouses: ${warehouseMap.size}`,
          );

          // Perform CRUD operations using the new service within the same transaction
          return await this.productCrudService.syncProductsCrudWithTransaction(
            tx,
            allKiotVietProducts,
            categoryMap,
            businessMap,
            warehouseMap,
            removeIds,
          );
        },
        {
          timeout: 600000, // 10 minutes timeout for large datasets
        },
      );

      // Step 4: Complete sync log
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const syncDetails: SyncLogDetails = {
        totalRecords: allKiotVietProducts.length,
        successCount: crudResult.stats.created + crudResult.stats.updated,
        failedCount: crudResult.stats.errors,
        errorDetails: crudResult.errors,
        productStats: {
          adds: crudResult.stats.created,
          updates: crudResult.stats.updated,
          deletes: crudResult.stats.deleted,
          skips: 0,
          conflicts: 0,
          errors: crudResult.stats.errors,
        },
        categoryStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        businessStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        warehouseStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        userStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productImageStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productInventoryStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productAttributeStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productUnitStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productPriceBookStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productFormulaStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productSerialStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productBatchExpireStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productWarrantyStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productShelfStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
      };

      await this.syncLogService.completeSyncLog(
        syncLogId,
        crudResult.success ? SyncStatus.SUCCESS : SyncStatus.PARTIAL,
        syncDetails,
      );

      this.logger.log('='.repeat(80));
      this.logger.log('📊 ENHANCED KIOTVIET PRODUCT CRUD SYNC COMPLETE');
      this.logger.log('='.repeat(80));
      this.logger.log(`✅ Created: ${crudResult.stats.created} products`);
      this.logger.log(`🔄 Updated: ${crudResult.stats.updated} products`);
      this.logger.log(`🗑️  Deleted: ${crudResult.stats.deleted} products`);
      this.logger.log(`❌ Errors: ${crudResult.stats.errors} products`);
      this.logger.log(`⏱️  Duration: ${duration}ms`);
      this.logger.log('='.repeat(80));

      return {
        success: crudResult.success,
        syncLogId,
        duration,
        details: syncDetails,
        crudStats: crudResult.stats,
      };
    } catch (error) {
      this.logger.error('Enhanced product CRUD sync failed:', error);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const errorDetails: SyncLogDetails = {
        totalRecords: 0,
        successCount: 0,
        failedCount: 1,
        errorDetails: [error.message],
        productStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 1,
        },
        categoryStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        businessStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        warehouseStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        userStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productImageStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productInventoryStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productAttributeStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productUnitStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productPriceBookStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productFormulaStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productSerialStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productBatchExpireStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productWarrantyStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
        productShelfStats: {
          adds: 0,
          updates: 0,
          skips: 0,
          conflicts: 0,
          deletes: 0,
          errors: 0,
        },
      };

      if (syncLogId!) {
        await this.syncLogService.completeSyncLog(
          syncLogId,
          SyncStatus.FAILED,
          errorDetails,
        );
      }

      throw error;
    }
  }

  /**
   * Fetch all products from KiotViet API using pagination
   */
  private async fetchAllKiotVietProducts(
    user: JwtPayload,
  ): Promise<KiotVietProductItem[]> {
    const allProducts: KiotVietProductItem[] = [];
    let currentItem = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.kiotVietProductService.getProducts(user, {
          currentItem,
          pageSize,
          orderBy: 'modifiedDate',
          orderDirection: 'desc',
          includeRemoveIds: false,
        });

        if (response.data && response.data.length > 0) {
          allProducts.push(...response.data);
          currentItem += pageSize;
          hasMore = response.data.length === pageSize;

          this.logger.debug(
            `Fetched ${response.data.length} products (total: ${allProducts.length})`,
          );
        } else {
          hasMore = false;
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch products at position ${currentItem}:`,
          error,
        );
        hasMore = false;
      }
    }

    return allProducts;
  }

  /**
   * Fetch removed product IDs from KiotViet API
   */
  private async fetchRemovedProductIds(user: JwtPayload): Promise<number[]> {
    try {
      const response = await this.kiotVietProductService.getProducts(user, {
        currentItem: 0,
        pageSize: 1,
        includeRemoveIds: true,
      });

      return response.removeIds || [];
    } catch (error) {
      this.logger.error('Failed to fetch removed product IDs:', error);
      return [];
    }
  }

  private getUniqueCategories(
    products: any[],
  ): Array<{ id: number; name: string }> {
    const categoryMap = new Map<number, string>();

    products.forEach((product) => {
      if (product.categoryId && product.categoryName) {
        // Convert categoryId to integer for consistent mapping
        const categoryIdNum = parseInt(product.categoryId.toString());
        if (!isNaN(categoryIdNum)) {
          categoryMap.set(categoryIdNum, product.categoryName);
        }
      }
    });

    this.logger.debug(
      `Extracted ${categoryMap.size} unique categories from products`,
    );
    return Array.from(categoryMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  private getUniqueTradeMarks(
    products: any[],
  ): Array<{ id: number; name: string }> {
    const tradeMarkMap = new Map<number, string>();

    products.forEach((product) => {
      // Extract from mapped products using businessId/businessName
      if (product.tradeMarkId && product.tradeMarkName) {
        // Convert businessId string to number for trademark ID mapping
        const businessIdNum = parseInt(product.tradeMarkId.toString());
        if (!isNaN(businessIdNum)) {
          tradeMarkMap.set(businessIdNum, product.tradeMarkName);
        }
      }
    });

    this.logger.debug(
      `Extracted ${tradeMarkMap.size} unique trademarks from products`,
    );
    return Array.from(tradeMarkMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }

  private getUniqueBranches(
    products: any[],
  ): Array<{ id: number; name: string }> {
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

    return Array.from(branchMap.entries()).map(([id, name]) => ({ id, name }));
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

        // Sync warehouses from product inventories if they don't exist
        await this.syncWarehousesFromInventories(
          tx,
          detailedProduct.inventories,
          warehouseMap,
          syncDetails.warehouseStats!,
        );

        // Create or update the product with all its relationships
        await this.createProductWithRelationships(
          tx,
          detailedProduct,
          mappedProduct,
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
   * Sync warehouses from product inventories
   */
  private async syncWarehousesFromInventories(
    tx: any,
    inventories: any[],
    warehouseMap: Map<number, string>,
    warehouseStats: any,
  ): Promise<void> {
    for (const inventory of inventories) {
      if (inventory.branchId && !warehouseMap.has(inventory.branchId)) {
        try {
          // Create warehouse from branch information
          const warehouse = await tx.warehouse.create({
            data: {
              kiotVietWarehouseId: inventory.branchId,
              name: inventory.branchName || `Branch ${inventory.branchId}`,
              isActive: true,
              source: 'kiotviet',
            },
          });

          warehouseMap.set(inventory.branchId, warehouse.id);
          warehouseStats.adds++;

          this.logger.debug(
            `Created warehouse ${warehouse.name} from inventory branch ${inventory.branchId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to create warehouse for branch ${inventory.branchId}:`,
            error,
          );
          warehouseStats.errors++;
        }
      }
    }
  }

  /**
   * Create product with all its relationships
   */
  private async createProductWithRelationships(
    tx: any,
    detailedProduct: KiotVietProductItem,
    mappedProduct: any,
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    syncDetails: SyncLogDetails,
  ): Promise<void> {
    // Get required IDs
    const categoryId = categoryMap.get(detailedProduct.categoryId);
    const businessId = businessMap.get(detailedProduct.tradeMarkId);

    if (!categoryId || !businessId) {
      throw new Error(
        `Missing required relationships for product ${detailedProduct.code}`,
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
          ...this.buildProductData(detailedProduct, categoryId, businessId),
          updatedAt: new Date(),
        },
      });
      productId = existingProduct.id;
      syncDetails.productStats!.updates++;
    } else {
      // Create new product
      const newProduct = await tx.product.create({
        data: this.buildProductData(detailedProduct, categoryId, businessId),
      });
      productId = newProduct.id;
      syncDetails.productStats!.adds++;
    }

    // Sync all product relationships
    await this.syncProductRelationships(
      tx,
      productId,
      detailedProduct,
      warehouseMap,
      syncDetails,
    );
  }

  /**
   * Build product data object from KiotViet product
   */
  private buildProductData(
    kiotVietProduct: KiotVietProductItem,
    categoryId: string,
    businessId: string,
  ): any {
    const slug = this.productUtil.generateSlug(kiotVietProduct.name);
    const thumbnail = kiotVietProduct.images?.[0] || '';

    return {
      code: kiotVietProduct.code,
      kiotVietProductId: kiotVietProduct.id,
      kiotVietModifiedDate: kiotVietProduct.modifiedDate,
      kiotVietCategoryId: kiotVietProduct.categoryId,
      kiotVietBusinessId: kiotVietProduct.tradeMarkId,
      masterKiotVietProductId: kiotVietProduct.masterProductId,
      masterKiotVietUnitId: kiotVietProduct.masterUnitId,
      name: kiotVietProduct.name,
      barCode: kiotVietProduct.barCode,
      slug,
      description: kiotVietProduct.description || kiotVietProduct.fullName,
      type: this.mapProductType(kiotVietProduct.type),
      weight: kiotVietProduct.weight,
      source: 'kiotviet',
      price: kiotVietProduct.basePrice || 0,
      basePrice: kiotVietProduct.basePrice || 0,
      minQuantity: kiotVietProduct.minQuantity || 1,
      maxQuantity: kiotVietProduct.maxQuantity,
      thumbnail,
      isActive: kiotVietProduct.isActive,
      allowsSale: kiotVietProduct.allowsSale,
      specifications: this.buildSpecifications(kiotVietProduct),
      isLotSerialControl: kiotVietProduct.isLotSerialControl || false,
      isBatchExpireControl: kiotVietProduct.isBatchExpireControl || false,
      isRewardPoint: kiotVietProduct.isRewardPoint || false,
      taxType: this.mapTaxType(kiotVietProduct.taxType),
      taxRate: kiotVietProduct.taxRate,
      taxRateDirect: kiotVietProduct.taxRateDirect,
      taxName: kiotVietProduct.taxname,
      unit: kiotVietProduct.unit,
      conversionValue: kiotVietProduct.conversionValue || 1,
      categoryId,
      businessId,
    };
  }

  /**
   * Sync all product relationships
   */
  private async syncProductRelationships(
    tx: any,
    productId: string,
    kiotVietProduct: KiotVietProductItem,
    warehouseMap: Map<number, string>,
    syncDetails: SyncLogDetails,
  ): Promise<void> {
    // Sync product images
    if (kiotVietProduct.images && kiotVietProduct.images.length > 0) {
      await this.syncProductImages(
        tx,
        productId,
        kiotVietProduct.images,
        syncDetails.productImageStats!,
      );
    }

    // Sync product inventories
    if (kiotVietProduct.inventories && kiotVietProduct.inventories.length > 0) {
      await this.syncProductInventories(
        tx,
        productId,
        kiotVietProduct.inventories,
        warehouseMap,
        syncDetails.productInventoryStats!,
      );
    }

    // Sync product attributes
    if (kiotVietProduct.attributes && kiotVietProduct.attributes.length > 0) {
      await this.syncProductAttributes(
        tx,
        productId,
        kiotVietProduct.attributes,
        syncDetails.productAttributeStats!,
      );
    }

    // Sync product units
    if (kiotVietProduct.units && kiotVietProduct.units.length > 0) {
      await this.syncProductUnits(
        tx,
        productId,
        kiotVietProduct.units,
        syncDetails.productUnitStats!,
      );
    }

    // Sync product price books
    if (kiotVietProduct.priceBooks && kiotVietProduct.priceBooks.length > 0) {
      await this.syncProductPriceBooks(
        tx,
        productId,
        kiotVietProduct.priceBooks,
        syncDetails.productPriceBookStats!,
      );
    }

    // Sync product formulas
    if (
      kiotVietProduct.productFormulas &&
      kiotVietProduct.productFormulas.length > 0
    ) {
      await this.syncProductFormulas(
        tx,
        productId,
        kiotVietProduct.productFormulas,
        syncDetails.productFormulaStats!,
      );
    }

    // Sync product serials
    if (kiotVietProduct.serials && kiotVietProduct.serials.length > 0) {
      await this.syncProductSerials(
        tx,
        productId,
        kiotVietProduct.serials,
        syncDetails.productSerialStats!,
      );
    }

    // Sync product batch expires
    if (
      kiotVietProduct.productBatchExpires &&
      kiotVietProduct.productBatchExpires.length > 0
    ) {
      await this.syncProductBatchExpires(
        tx,
        productId,
        kiotVietProduct.productBatchExpires,
        warehouseMap,
        syncDetails.productBatchExpireStats!,
      );
    }

    // Sync product warranties
    if (
      kiotVietProduct.productWarranties &&
      kiotVietProduct.productWarranties.length > 0
    ) {
      await this.syncProductWarranties(
        tx,
        productId,
        kiotVietProduct.productWarranties,
        syncDetails.productWarrantyStats!,
      );
    }

    // Sync product shelves
    if (
      kiotVietProduct.productShelves &&
      kiotVietProduct.productShelves.length > 0
    ) {
      await this.syncProductShelves(
        tx,
        productId,
        kiotVietProduct.productShelves,
        warehouseMap,
        syncDetails.productShelfStats!,
      );
    }
  }

  /**
   * Helper methods for syncing individual relationship types
   */

  private async syncProductImages(
    tx: any,
    productId: string,
    images: any[],
    stats: any,
  ): Promise<void> {
    try {
      // Delete all existing images for product
      await tx.productImage.deleteMany({
        where: { productId },
      });

      // Create new images in order
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        let imageUrl: string;

        // Handle both string URLs and object URLs
        if (typeof image === 'string') {
          imageUrl = image;
        } else if (typeof image === 'object' && image.url) {
          imageUrl = image.url;
        } else {
          this.logger.warn(
            `Skipping invalid image at index ${i} for product ${productId}`,
          );
          continue;
        }

        await tx.productImage.create({
          data: {
            url: imageUrl,
            sortOrder: typeof image === 'object' ? (image.sortOrder ?? i) : i,
            isMain:
              typeof image === 'object' ? (image.isMain ?? i === 0) : i === 0,
            productId,
          },
        });
      }
      stats.adds += images.length;
    } catch (error) {
      this.logger.error(`Failed to sync product images:`, error);
      stats.errors++;
    }
  }

  private async syncProductInventories(
    tx: any,
    productId: string,
    inventories: any[],
    warehouseMap: Map<number, string>,
    stats: any,
  ): Promise<void> {
    for (const inventory of inventories) {
      try {
        const warehouseId = warehouseMap.get(inventory.branchId);
        if (!warehouseId) continue;

        await tx.productInventory.upsert({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId,
            },
          },
          update: {
            cost: inventory.cost || 0,
            onHand: inventory.onHand || 0,
            onOrder: inventory.onOrder || 0,
            reserved: inventory.reserved || 0,
            minQuantity: inventory.minQuantity || 0,
            maxQuantity: inventory.maxQuantity,
          },
          create: {
            kiotVietWarehouseId: inventory.branchId,
            productId,
            warehouseId,
            cost: inventory.cost || 0,
            onHand: inventory.onHand || 0,
            onOrder: inventory.onOrder || 0,
            reserved: inventory.reserved || 0,
            actualReserved: 0,
            minQuantity: inventory.minQuantity || 0,
            maxQuantity: inventory.maxQuantity,
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product inventory:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductAttributes(
    tx: any,
    productId: string,
    attributes: any[],
    stats: any,
  ): Promise<void> {
    for (const attribute of attributes) {
      try {
        // Check if attribute exists, create or update accordingly
        const existingAttribute = await tx.productAttribute.findFirst({
          where: {
            productId,
            attributeName: attribute.attributeName,
          },
        });

        if (existingAttribute) {
          await tx.productAttribute.update({
            where: { id: existingAttribute.id },
            data: {
              attributeValue: attribute.attributeValue,
            },
          });
        } else {
          await tx.productAttribute.create({
            data: {
              productId,
              attributeName: attribute.attributeName,
              attributeValue: attribute.attributeValue,
              source: 'kiotviet',
            },
          });
        }
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product attribute:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductUnits(
    tx: any,
    productId: string,
    units: any[],
    stats: any,
  ): Promise<void> {
    for (const unit of units) {
      try {
        await tx.productUnit.upsert({
          where: {
            kiotVietUnitId: unit.id,
          },
          update: {
            name: unit.name,
            unit: unit.unit,
            conversionValue: unit.conversionValue || 1,
          },
          create: {
            kiotVietUnitId: unit.id,
            code: unit.code,
            name: unit.name,
            unit: unit.unit,
            conversionValue: unit.conversionValue || 1,
            productId,
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product unit:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductPriceBooks(
    tx: any,
    productId: string,
    priceBooks: any[],
    stats: any,
  ): Promise<void> {
    for (const priceBook of priceBooks) {
      try {
        // First, ensure the global price book exists
        let globalPriceBook = await tx.priceBook.findUnique({
          where: { kiotVietPriceBookId: priceBook.priceBookId },
        });

        if (!globalPriceBook) {
          globalPriceBook = await tx.priceBook.create({
            data: {
              kiotVietPriceBookId: priceBook.priceBookId,
              name:
                priceBook.priceBookName ||
                `Price Book ${priceBook.priceBookId}`,
              price: priceBook.price || 0,
              type: 'product',
              isActive: priceBook.isActive ?? true,
              source: 'kiotviet',
            },
          });
        }

        // Then create/update the product price book relationship
        await tx.productPriceBook.upsert({
          where: {
            priceBookId_productId: {
              priceBookId: globalPriceBook.id,
              productId,
            },
          },
          update: {
            name: priceBook.priceBookName,
            price: priceBook.price || 0,
            isActive: priceBook.isActive ?? true,
            startDate: priceBook.startDate,
            endDate: priceBook.endDate,
          },
          create: {
            kiotVietPriceBookId: priceBook.priceBookId,
            productId,
            priceBookId: globalPriceBook.id,
            name: priceBook.priceBookName,
            price: priceBook.price || 0,
            isActive: priceBook.isActive ?? true,
            startDate: priceBook.startDate,
            endDate: priceBook.endDate,
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product price book:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductFormulas(
    tx: any,
    productId: string,
    formulas: any[],
    stats: any,
  ): Promise<void> {
    for (const formula of formulas) {
      try {
        // Check if formula exists, create or update accordingly
        const existingFormula = await tx.productFormula.findFirst({
          where: {
            productId,
            kiotVietMaterialId: formula.materialId,
          },
        });

        if (existingFormula) {
          await tx.productFormula.update({
            where: { id: existingFormula.id },
            data: {
              materialName: formula.materialName || formula.materialFullName,
              quantity: formula.quantity || 0,
            },
          });
        } else {
          await tx.productFormula.create({
            data: {
              productId,
              kiotVietMaterialId: formula.materialId,
              kiotVietMaterialCode: formula.materialCode,
              materialName: formula.materialName || formula.materialFullName,
              quantity: formula.quantity || 0,
              source: 'kiotviet',
            },
          });
        }
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product formula:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductSerials(
    tx: any,
    productId: string,
    serials: any[],
    stats: any,
  ): Promise<void> {
    for (const serial of serials) {
      try {
        await tx.productSerial.upsert({
          where: {
            productId_serialNumber: {
              productId,
              serialNumber: serial.serialNumber,
            },
          },
          update: {
            status: serial.status || 0,
            quantity: serial.quantity,
            modifiedDate: serial.modifiedDate,
          },
          create: {
            kiotVietSerialId: serial.id,
            kiotVietProductId: serial.productId,
            kiotVietWarehouseId: serial.branchId,
            productId,
            serialNumber: serial.serialNumber,
            status: serial.status || 0,
            quantity: serial.quantity,
            modifiedDate: serial.modifiedDate,
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product serial:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductBatchExpires(
    tx: any,
    productId: string,
    batchExpires: any[],
    warehouseMap: Map<number, string>,
    stats: any,
  ): Promise<void> {
    for (const batch of batchExpires) {
      try {
        const warehouseId = warehouseMap.get(batch.branchId);
        if (!warehouseId) continue;

        await tx.productBatchExpire.upsert({
          where: {
            warehouseId_productId_batchName: {
              warehouseId,
              productId,
              batchName: batch.batchName,
            },
          },
          update: {
            onHand: batch.onHand || 0,
            expireDate: batch.expireDate,
            fullNameVirgule: batch.fullNameVirgule,
          },
          create: {
            kiotVietBatchExpireId: batch.id,
            kiotVietProductId: batch.productId,
            kiotVietWarehouseId: batch.branchId,
            productId,
            warehouseId,
            onHand: batch.onHand || 0,
            batchName: batch.batchName,
            expireDate: batch.expireDate,
            fullNameVirgule: batch.fullNameVirgule,
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product batch expire:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductWarranties(
    tx: any,
    productId: string,
    warranties: any[],
    stats: any,
  ): Promise<void> {
    for (const warranty of warranties) {
      try {
        await tx.productWarranty.upsert({
          where: {
            productId_warrantyType_timeType: {
              productId,
              warrantyType: this.mapWarrantyType(warranty.warrantyType),
              timeType: this.mapWarrantyTimeType(warranty.timeType),
            },
          },
          update: {
            description: warranty.description,
            numberTime: warranty.numberTime,
          },
          create: {
            kiotVietWarrantyId: warranty.id,
            kiotVietProductId: warranty.productId,
            kiotVietTimeType: warranty.timeType,
            kiotVietWarrantyType: warranty.warrantyType,
            productId,
            description: warranty.description,
            numberTime: warranty.numberTime,
            timeType: this.mapWarrantyTimeType(warranty.timeType),
            warrantyType: this.mapWarrantyType(warranty.warrantyType),
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product warranty:`, error);
        stats.errors++;
      }
    }
  }

  private async syncProductShelves(
    tx: any,
    productId: string,
    shelves: any[],
    warehouseMap: Map<number, string>,
    stats: any,
  ): Promise<void> {
    for (const shelf of shelves) {
      try {
        const warehouseId = warehouseMap.get(shelf.branchId);
        if (!warehouseId) continue;

        await tx.productShelf.upsert({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId,
            },
          },
          update: {
            productShelves: shelf.ProductShelves,
          },
          create: {
            kiotVietShelfId: shelf.id,
            kiotVietWarehouseId: shelf.branchId,
            productId,
            warehouseId,
            productShelves: shelf.ProductShelves,
            source: 'kiotviet',
          },
        });
        stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to sync product shelf:`, error);
        stats.errors++;
      }
    }
  }

  /**
   * Helper methods for mapping KiotViet data to system enums
   */
  private mapProductType(kiotVietType: number): string {
    switch (kiotVietType) {
      case 1:
        return 'product';
      case 2:
        return 'service';
      case 3:
        return 'combo';
      default:
        return 'product';
    }
  }

  private mapTaxType(kiotVietTaxType: string): string {
    if (!kiotVietTaxType) return 'zero';

    switch (kiotVietTaxType.toLowerCase()) {
      case '0%':
      case 'zero':
        return 'zero';
      case '5%':
      case 'five':
        return 'five';
      case '8%':
      case 'eight':
        return 'eight';
      case '10%':
      case 'ten':
        return 'ten';
      case 'kct':
        return 'kct';
      case 'kkknt':
        return 'kkknt';
      default:
        return 'khac';
    }
  }

  private mapWarrantyType(kiotVietWarrantyType: number): string {
    switch (kiotVietWarrantyType) {
      case 0:
        return 'none';
      case 1:
        return 'electronic';
      case 2:
        return 'manual_ticket';
      case 3:
        return 'exchange_only';
      case 4:
        return 'return_only';
      case 5:
        return 'exchange_and_return';
      case 6:
        return 'manufacturer_warranty';
      case 7:
        return 'store_warranty';
      case 8:
        return 'lifetime';
      case 9:
        return 'service_included';
      default:
        return 'none';
    }
  }

  private mapWarrantyTimeType(kiotVietTimeType: number): string {
    switch (kiotVietTimeType) {
      case 1:
        return 'day';
      case 2:
        return 'month';
      case 3:
        return 'year';
      default:
        return 'month';
    }
  }

  private buildSpecifications(kiotVietProduct: KiotVietProductItem): any {
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
}
