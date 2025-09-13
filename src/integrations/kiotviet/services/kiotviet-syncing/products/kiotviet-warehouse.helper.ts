import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class KiotVietWarehouseHelper {
  private readonly logger = new Logger(KiotVietWarehouseHelper.name);

  /**
   * Sync warehouses from product inventories
   */
  async syncWarehousesFromInventories(
    tx: any,
    inventories: any[],
    warehouseMap: Map<number, string>,
    warehouseStats: any,
  ): Promise<void> {
    if (!inventories || inventories.length === 0) {
      this.logger.debug('No inventories to sync warehouses from');
      return;
    }

    for (const inventory of inventories) {
      if (!inventory || !inventory.branchId) {
        this.logger.debug('Skipping inventory without branchId');
        continue;
      }

      if (!warehouseMap.has(inventory.branchId)) {
        try {
          // Check if warehouse already exists in database
          const existingWarehouse = await tx.warehouse.findFirst({
            where: {
              kiotVietWarehouseId: inventory.branchId,
            },
          });

          if (existingWarehouse) {
            warehouseMap.set(inventory.branchId, existingWarehouse.id);
            warehouseStats.skips++;
            this.logger.debug(
              `Found existing warehouse ${existingWarehouse.name} for branch ${inventory.branchId}`,
            );
            continue;
          }

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

          // Don't throw error to avoid breaking the entire sync
          // Just log and continue with other inventories
        }
      }
    }
  }

  /**
   * Create warehouse from branch data
   */
  async createWarehouse(
    tx: any,
    branchId: number,
    branchName: string,
    warehouseMap: Map<number, string>,
    warehouseStats: any,
  ): Promise<string | null> {
    try {
      const warehouse = await tx.warehouse.create({
        data: {
          kiotVietWarehouseId: branchId,
          name: branchName || `Branch ${branchId}`,
          isActive: true,
          source: 'kiotviet',
        },
      });

      warehouseMap.set(branchId, warehouse.id);
      warehouseStats.adds++;

      this.logger.debug(
        `Created warehouse ${warehouse.name} from branch ${branchId}`,
      );

      return warehouse.id;
    } catch (error) {
      this.logger.error(
        `Failed to create warehouse for branch ${branchId}:`,
        error,
      );
      warehouseStats.errors++;
      return null;
    }
  }

  /**
   * Get or create warehouse for branch
   */
  async getOrCreateWarehouse(
    tx: any,
    branchId: number,
    branchName: string,
    warehouseMap: Map<number, string>,
    warehouseStats: any,
  ): Promise<string | null> {
    // Check if warehouse already exists in map
    const existingWarehouseId = warehouseMap.get(branchId);
    if (existingWarehouseId) {
      return existingWarehouseId;
    }

    // Check if warehouse exists in database
    const existingWarehouse = await tx.warehouse.findFirst({
      where: { kiotVietWarehouseId: branchId },
    });

    if (existingWarehouse) {
      warehouseMap.set(branchId, existingWarehouse.id);
      return existingWarehouse.id;
    }

    // Create new warehouse
    return this.createWarehouse(
      tx,
      branchId,
      branchName,
      warehouseMap,
      warehouseStats,
    );
  }

  /**
   * Validate warehouse mappings
   */
  validateWarehouseMappings(
    inventories: any[],
    warehouseMap: Map<number, string>,
  ): { valid: boolean; missingBranches: number[] } {
    const missingBranches: number[] = [];

    for (const inventory of inventories) {
      if (inventory.branchId && !warehouseMap.has(inventory.branchId)) {
        missingBranches.push(inventory.branchId);
      }
    }

    return {
      valid: missingBranches.length === 0,
      missingBranches,
    };
  }
}
