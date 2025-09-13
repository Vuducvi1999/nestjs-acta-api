import { Injectable, Logger } from '@nestjs/common';
import { KiotVietProductItem } from '../../../../interfaces/kiotviet.product.interface';

@Injectable()
export class KiotVietProductRelationshipsHelper {
  private readonly logger = new Logger(KiotVietProductRelationshipsHelper.name);

  /**
   * Sync all product relationships
   */
  async syncProductRelationships(
    tx: any,
    productId: string,
    kiotVietProduct: KiotVietProductItem,
    warehouseMap: Map<number, string>,
    syncDetails: any,
  ): Promise<void> {
    // Sync product images
    if (kiotVietProduct.images && kiotVietProduct.images.length > 0) {
      try {
        await this.syncProductImages(
          tx,
          productId,
          kiotVietProduct.images,
          syncDetails.productImageStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product images for product ${productId}:`,
          error,
        );
        syncDetails.productImageStats!.errors++;
      }
    }

    // Sync product inventories
    if (kiotVietProduct.inventories && kiotVietProduct.inventories.length > 0) {
      try {
        await this.syncProductInventories(
          tx,
          productId,
          kiotVietProduct.inventories,
          warehouseMap,
          syncDetails.productInventoryStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product inventories for product ${productId}:`,
          error,
        );
        syncDetails.productInventoryStats!.errors++;
      }
    }

    // Sync product attributes
    if (kiotVietProduct.attributes && kiotVietProduct.attributes.length > 0) {
      try {
        await this.syncProductAttributes(
          tx,
          productId,
          kiotVietProduct.attributes,
          syncDetails.productAttributeStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product attributes for product ${productId}:`,
          error,
        );
        syncDetails.productAttributeStats!.errors++;
      }
    }

    // Sync product units
    if (kiotVietProduct.units && kiotVietProduct.units.length > 0) {
      try {
        await this.syncProductUnits(
          tx,
          productId,
          kiotVietProduct.units,
          syncDetails.productUnitStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product units for product ${productId}:`,
          error,
        );
        syncDetails.productUnitStats!.errors++;
      }
    }

    // Sync product price books
    if (kiotVietProduct.priceBooks && kiotVietProduct.priceBooks.length > 0) {
      try {
        await this.syncProductPriceBooks(
          tx,
          productId,
          kiotVietProduct.priceBooks,
          syncDetails.productPriceBookStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product price books for product ${productId}:`,
          error,
        );
        syncDetails.productPriceBookStats!.errors++;
      }
    }

    // Sync product formulas
    if (
      kiotVietProduct.productFormulas &&
      kiotVietProduct.productFormulas.length > 0
    ) {
      try {
        await this.syncProductFormulas(
          tx,
          productId,
          kiotVietProduct.productFormulas,
          syncDetails.productFormulaStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product formulas for product ${productId}:`,
          error,
        );
        syncDetails.productFormulaStats!.errors++;
      }
    }

    // Sync product serials
    if (kiotVietProduct.serials && kiotVietProduct.serials.length > 0) {
      try {
        await this.syncProductSerials(
          tx,
          productId,
          kiotVietProduct.serials,
          syncDetails.productSerialStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product serials for product ${productId}:`,
          error,
        );
        syncDetails.productSerialStats!.errors++;
      }
    }

    // Sync product batch expires
    if (
      kiotVietProduct.productBatchExpires &&
      kiotVietProduct.productBatchExpires.length > 0
    ) {
      try {
        await this.syncProductBatchExpires(
          tx,
          productId,
          kiotVietProduct.productBatchExpires,
          warehouseMap,
          syncDetails.productBatchExpireStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product batch expires for product ${productId}:`,
          error,
        );
        syncDetails.productBatchExpireStats!.errors++;
      }
    }

    // Sync product warranties
    if (
      kiotVietProduct.productWarranties &&
      kiotVietProduct.productWarranties.length > 0
    ) {
      try {
        await this.syncProductWarranties(
          tx,
          productId,
          kiotVietProduct.productWarranties,
          syncDetails.productWarrantyStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product warranties for product ${productId}:`,
          error,
        );
        syncDetails.productWarrantyStats!.errors++;
      }
    }

    // Sync product shelves
    if (
      kiotVietProduct.productShelves &&
      kiotVietProduct.productShelves.length > 0
    ) {
      try {
        await this.syncProductShelves(
          tx,
          productId,
          kiotVietProduct.productShelves,
          warehouseMap,
          syncDetails.productShelfStats!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to sync product shelves for product ${productId}:`,
          error,
        );
        syncDetails.productShelfStats!.errors++;
      }
    }
  }

  /**
   * Sync product images
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

  /**
   * Sync product inventories
   */
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

  /**
   * Sync product attributes
   */
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

  /**
   * Sync product units
   */
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

  /**
   * Sync product price books
   */
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

  /**
   * Sync product formulas
   */
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

  /**
   * Sync product serials
   */
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

  /**
   * Sync product batch expires
   */
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

  /**
   * Sync product warranties
   */
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

  /**
   * Sync product shelves
   */
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
   * Map warranty type from KiotViet to system enum
   */
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

  /**
   * Map warranty time type from KiotViet to system enum
   */
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
}
