import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { SyncDirection, SyncEntityType, SyncStatus } from '@prisma/client';

export interface SyncStats {
  adds: number;
  updates: number;
  skips: number;
  conflicts: number;
  deletes: number;
  errors: number;
}

export interface SyncLogDetails {
  totalRecords: number;
  successCount: number;
  failedCount: number;
  errorDetails?: string[];
  categoryStats?: SyncStats;
  businessStats?: SyncStats;
  warehouseStats?: SyncStats;
  productStats?: SyncStats;
  userStats?: SyncStats;
  // New product relationship statistics
  productImageStats?: SyncStats;
  productInventoryStats?: SyncStats;
  productAttributeStats?: SyncStats;
  productUnitStats?: SyncStats;
  productPriceBookStats?: SyncStats;
  productFormulaStats?: SyncStats;
  productSerialStats?: SyncStats;
  productBatchExpireStats?: SyncStats;
  productWarrantyStats?: SyncStats;
  productShelfStats?: SyncStats;
  productVariantStats?: SyncStats;
  productOrderTemplateStats?: SyncStats;
}

@Injectable()
export class KiotVietSyncLogService {
  private readonly logger = new Logger(KiotVietSyncLogService.name);

  constructor(public readonly prisma: PrismaService) {}

  /**
   * Create a sync log entry
   */
  async createSyncLog(
    direction: SyncDirection,
    entityType: SyncEntityType,
    status: SyncStatus,
    details: SyncLogDetails,
    entityId?: string,
    startTime?: Date,
    endTime?: Date,
  ) {
    try {
      const syncLog = await this.prisma.syncLog.create({
        data: {
          direction,
          entityType,
          status,
          entityId,
          details: details as any,
          startTime: startTime || new Date(),
          endTime: endTime || new Date(),
        },
      });

      this.logger.log(
        `Sync log created: ${entityType} sync ${status.toLowerCase()} - ${details.successCount}/${details.totalRecords} records processed`,
      );

      return syncLog;
    } catch (error) {
      this.logger.error('Failed to create sync log:', error);
      throw error;
    }
  }

  /**
   * Update an existing sync log
   */
  async updateSyncLog(
    logId: string,
    status: SyncStatus,
    details: Partial<SyncLogDetails>,
    endTime?: Date,
  ) {
    try {
      const updatedLog = await this.prisma.syncLog.update({
        where: { id: logId },
        data: {
          status,
          details: details as any,
          endTime: endTime || new Date(),
        },
      });

      this.logger.log(`Sync log updated: ${logId} - Status: ${status}`);
      return updatedLog;
    } catch (error) {
      this.logger.error(`Failed to update sync log ${logId}:`, error);
      throw error;
    }
  }

  /**
   * Get sync log history
   */
  async getSyncLogs(
    entityType?: SyncEntityType,
    direction?: SyncDirection,
    limit: number = 50,
  ) {
    return await this.prisma.syncLog.findMany({
      where: {
        ...(entityType && { entityType }),
        ...(direction && { direction }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get the latest sync log for an entity type
   */
  async getLatestSyncLog(entityType: SyncEntityType, direction: SyncDirection) {
    return await this.prisma.syncLog.findFirst({
      where: {
        entityType,
        direction,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Calculate sync statistics
   */
  calculateSyncStats(
    totalRecords: number,
    successCount: number,
    failedCount: number,
    adds: number = 0,
    updates: number = 0,
    skips: number = 0,
    conflicts: number = 0,
    deletes: number = 0,
  ): SyncStats {
    return {
      adds,
      updates,
      skips,
      conflicts,
      deletes,
      errors: failedCount,
    };
  }

  /**
   * Log sync summary
   */
  logSyncSummary(entityType: SyncEntityType, details: SyncLogDetails) {
    const buildStatLine = (
      label: string,
      stats: SyncStats | undefined,
    ): string => {
      if (!stats) return '';
      return `${label} - Adds: ${stats.adds}, Updates: ${stats.updates}, Skips: ${stats.skips}, Conflicts: ${stats.conflicts}, Deletes: ${stats.deletes}, Errors: ${stats.errors}`;
    };

    this.logger.log(`
=== KiotViet ${entityType} Sync Summary ===
Total Records: ${details.totalRecords}
Success: ${details.successCount}
Failed: ${details.failedCount}

== Entity Statistics ==
${buildStatLine('Categories', details.categoryStats)}
${buildStatLine('Businesses', details.businessStats)}
${buildStatLine('Warehouses', details.warehouseStats)}
${buildStatLine('Users', details.userStats)}
${buildStatLine('Products', details.productStats)}

== Product Relationship Statistics ==
${buildStatLine('Product Images', details.productImageStats)}
${buildStatLine('Product Inventories', details.productInventoryStats)}
${buildStatLine('Product Attributes', details.productAttributeStats)}
${buildStatLine('Product Units', details.productUnitStats)}
${buildStatLine('Product Price Books', details.productPriceBookStats)}
${buildStatLine('Product Formulas', details.productFormulaStats)}
${buildStatLine('Product Serials', details.productSerialStats)}
${buildStatLine('Product Batch Expires', details.productBatchExpireStats)}
${buildStatLine('Product Warranties', details.productWarrantyStats)}
${buildStatLine('Product Shelves', details.productShelfStats)}
${buildStatLine('Product Variants', details.productVariantStats)}
${buildStatLine('Product Order Templates', details.productOrderTemplateStats)}
=====================================
    `);
  }

  /**
   * Create initial sync log and return the ID for later updates
   */
  async startSyncLog(
    direction: SyncDirection,
    entityType: SyncEntityType,
    totalRecords: number,
  ): Promise<string> {
    const syncLog = await this.createSyncLog(
      direction,
      entityType,
      SyncStatus.PENDING,
      {
        totalRecords,
        successCount: 0,
        failedCount: 0,
        errorDetails: [],
      },
    );

    return syncLog.id;
  }

  /**
   * Complete sync log with final statistics
   */
  async completeSyncLog(
    logId: string,
    status: SyncStatus,
    details: SyncLogDetails,
  ) {
    await this.updateSyncLog(logId, status, details);
    this.logSyncSummary(SyncEntityType.PRODUCT, details);
  }
}
