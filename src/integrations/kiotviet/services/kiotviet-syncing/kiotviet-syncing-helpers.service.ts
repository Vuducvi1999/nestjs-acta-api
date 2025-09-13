import { Injectable, Logger } from '@nestjs/common';
import { KiotVietProductUtil } from '../../utils/kiotviet-product.util';
import { SyncStats } from '../kiotviet-sync-log.service';
import {
  Gender,
  Role,
  UserStatus,
  BusinessType,
  CategoryGroup,
  OriginSource,
  ProductType,
  TaxType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class KiotVietSyncingHelpersService {
  private readonly logger = new Logger(KiotVietSyncingHelpersService.name);
  private readonly firstPositionProfile = 11000;

  constructor(private readonly productUtil: KiotVietProductUtil) {}

  async createCategories(
    tx: any,
    uniqueCategories: Array<{ id: number; name: string }>,
    stats: SyncStats,
  ): Promise<Map<number, string>> {
    const categoryMap = new Map<number, string>();

    this.logger.debug(
      `Processing ${uniqueCategories.length} categories: ${uniqueCategories.map((c) => `${c.id}:${c.name}`).join(', ')}`,
    );

    for (const category of uniqueCategories) {
      try {
        // Check if category already exists
        const existingCategory = await tx.category.findUnique({
          where: { kiotVietCategoryId: parseInt(category.id.toString()) },
        });

        if (existingCategory) {
          categoryMap.set(category.id, existingCategory.id);
          stats.skips++;
          this.logger.debug(
            `Found existing category: ${category.name} (ID: ${category.id})`,
          );
          continue;
        }

        // Create new category
        const slug = this.productUtil.generateCategorySlug(
          category.name,
          category.id,
        );
        const newCategory = await tx.category.create({
          data: {
            kiotVietCategoryId: parseInt(category.id.toString()),
            name: category.name,
            slug,
            description: `Danh mục được đồng bộ từ KiotViet: ${category.name}`,
            isActive: true,
            sortOrder: 0,
            source: OriginSource.kiotviet,
            group: CategoryGroup.c,
            isRoot: false,
          },
        });

        categoryMap.set(category.id, newCategory.id);
        stats.adds++;
        this.logger.debug(`Created category: ${category.name}`);
      } catch (error) {
        // Handle specific error types
        if (error.code === 'P2002') {
          // Unique constraint violation - try to find existing category
          this.logger.warn(
            `Category ${category.name} already exists, finding existing one`,
          );
          try {
            const existingCategory = await tx.category.findFirst({
              where: {
                OR: [
                  { kiotVietCategoryId: parseInt(category.id.toString()) },
                  { name: category.name },
                ],
              },
            });
            if (existingCategory) {
              categoryMap.set(category.id, existingCategory.id);
              stats.skips++;
            } else {
              stats.errors++;
            }
          } catch (findError) {
            this.logger.error(
              `Failed to find existing category ${category.name}:`,
              findError,
            );
            stats.errors++;
          }
        } else {
          this.logger.error(
            `Failed to create category ${category.name}:`,
            error,
          );
          stats.errors++;
        }
      }
    }

    return categoryMap;
  }

  async createUsersForBusinesses(
    tx: any,
    uniqueTradeMarks: Array<{ id: number; name: string }>,
    stats: SyncStats,
  ): Promise<Map<number, string>> {
    const userMap = new Map<number, string>();
    const profileCount = await tx.user.count();

    for (const tradeMark of uniqueTradeMarks) {
      try {
        // First check if business exists and has a user
        const existingBusiness = await tx.business.findUnique({
          where: { kiotVietTradeMarkId: parseInt(tradeMark.id.toString()) },
          include: { user: true },
        });

        if (existingBusiness && existingBusiness.user) {
          userMap.set(tradeMark.id, existingBusiness.user.id);
          stats.skips++;
          this.logger.debug(
            `Found existing user for business: ${tradeMark.name}`,
          );
          continue;
        }

        // Check if user already exists with the trademark name (case-insensitive)
        const userCode = `KVTM${tradeMark.id}`;
        const email = this.productUtil.generateBusinessEmail(
          userCode,
          tradeMark.name,
        );

        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              { email: email },
              { fullName: { equals: tradeMark.name, mode: 'insensitive' } },
            ],
          },
        });

        if (existingUser) {
          userMap.set(tradeMark.id, existingUser.id);
          stats.skips++;
          this.logger.debug(
            `Found existing user with trademark name: ${tradeMark.name}`,
          );
          continue;
        }

        // Generate user data
        const password = this.productUtil.generateBusinessPassword(userCode);
        const hashedPassword = await bcrypt.hash(password, 10);
        const phoneNumber = this.productUtil.generateBusinessPhone();
        const referenceId = this.productUtil.generateBusinessReferenceId(
          profileCount + userMap.size,
        );

        // Create avatar attachment
        const attachment = await tx.attachment.create({
          data: {
            fileName: `avatar_business_${Date.now()}.jpg`,
            mimeType: 'image',
            originalFileName: 'business_avatar.jpg',
            fileUrl:
              'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b',
          },
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email,
            passwordHash: hashedPassword,
            fullName: tradeMark.name || `Doanh nghiệp KiotViet ${tradeMark.id}`,
            phoneNumber,
            country: 'VN',
            referenceId,
            gender: Gender.not_known,
            dob: new Date(1990, 1, 1),
            status: UserStatus.active, // Business users are verified by default
            role: Role.user,
            avatarId: attachment.id,
            verificationDate: new Date(),
          },
        });

        // Create self-referral closure for business user
        await tx.userReferralClosure.create({
          data: {
            ancestorId: referenceId,
            descendantId: referenceId,
            depth: 0,
          },
        });

        userMap.set(tradeMark.id, user.id);
        stats.adds++;
        this.logger.debug(`Created user for business: ${tradeMark.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to create user for trademark ${tradeMark.name}:`,
          error.message || error,
        );
        stats.errors++;

        // If it's a unique constraint error, try to find the existing user
        if (error.code === 'P2002') {
          try {
            const userCode = `KVTM${tradeMark.id}`;
            const email = this.productUtil.generateBusinessEmail(
              userCode,
              tradeMark.name,
            );

            const existingUser = await tx.user.findFirst({
              where: {
                OR: [
                  { email: email },
                  { fullName: { equals: tradeMark.name, mode: 'insensitive' } },
                ],
              },
            });

            if (existingUser) {
              userMap.set(tradeMark.id, existingUser.id);
              stats.skips++;
              this.logger.debug(`Recovered existing user: ${tradeMark.name}`);
            }
          } catch (recoveryError) {
            this.logger.error(
              `Failed to recover user for ${tradeMark.name}:`,
              recoveryError,
            );
          }
        }
      }
    }

    return userMap;
  }

  async createBusinesses(
    tx: any,
    uniqueTradeMarks: Array<{ id: number; name: string }>,
    userMap: Map<number, string>,
    stats: SyncStats,
  ): Promise<Map<number, string>> {
    const businessMap = new Map<number, string>();

    for (const tradeMark of uniqueTradeMarks) {
      try {
        // Check if business already exists
        const existingBusiness = await tx.business.findUnique({
          where: { kiotVietTradeMarkId: parseInt(tradeMark.id.toString()) },
        });

        if (existingBusiness) {
          businessMap.set(tradeMark.id, existingBusiness.id);
          stats.skips++;
          this.logger.debug(`Found existing business: ${tradeMark.name}`);
          continue;
        }

        const userId = userMap.get(tradeMark.id);
        if (!userId) {
          this.logger.warn(
            `No user found for trademark ${tradeMark.id} (${tradeMark.name}), skipping business creation`,
          );
          stats.errors++;
          continue;
        }

        // Double-check if business exists for this user (in case of race conditions)
        const businessForUser = await tx.business.findFirst({
          where: {
            userId: userId,
            name: { equals: tradeMark.name, mode: 'insensitive' },
          },
        });

        if (businessForUser) {
          businessMap.set(tradeMark.id, businessForUser.id);
          stats.skips++;
          this.logger.debug(
            `Found existing business for user: ${tradeMark.name}`,
          );
          continue;
        }

        // Generate business data
        const slug = this.productUtil.generateBusinessSlug(
          tradeMark.name,
          tradeMark.id,
        );
        const code = `KVTM-${tradeMark.id}`;

        const business = await tx.business.create({
          data: {
            kiotVietTradeMarkId: parseInt(tradeMark.id.toString()),
            code,
            name: tradeMark.name,
            slug,
            description: `Thương hiệu được đồng bộ từ KiotViet: ${tradeMark.name}`,
            slogan: `Chất lượng từ ${tradeMark.name}`,
            email: this.productUtil.generateBusinessEmail(
              `TM${tradeMark.id}`,
              tradeMark.name,
            ),
            phone: this.productUtil.generateBusinessPhone(),
            website: `https://${slug}.kiotviet-sync.local`,
            address: 'Địa chỉ được cập nhật từ KiotViet',
            location: 'Việt Nam',
            source: OriginSource.kiotviet,
            type: BusinessType.platform,
            verified: true,
            isActive: true,
            joinDate: new Date(),
            rating: 0,
            totalRatings: 0,
            productCount: 0,
            followers: 0,
            responseRate: 0,
            responseTime: '24h',
            userId,
          },
        });

        businessMap.set(tradeMark.id, business.id);
        stats.adds++;
        this.logger.debug(`Created business: ${tradeMark.name}`);
      } catch (error) {
        this.logger.error(
          `Failed to create business ${tradeMark.name}:`,
          error.message || error,
        );
        stats.errors++;

        // If it's a unique constraint error, try to find the existing business
        if (error.code === 'P2002') {
          try {
            const existingBusiness = await tx.business.findFirst({
              where: {
                OR: [
                  { kiotVietTradeMarkId: parseInt(tradeMark.id.toString()) },
                  { name: { equals: tradeMark.name, mode: 'insensitive' } },
                ],
              },
            });

            if (existingBusiness) {
              businessMap.set(tradeMark.id, existingBusiness.id);
              stats.skips++;
              this.logger.debug(
                `Recovered existing business: ${tradeMark.name}`,
              );
            }
          } catch (recoveryError) {
            this.logger.error(
              `Failed to recover business for ${tradeMark.name}:`,
              recoveryError,
            );
          }
        }
      }
    }

    return businessMap;
  }

  /**
   * Validate and fix existing products using KiotViet mapping data
   */
  async validateAndFixExistingProducts(
    tx: any,
    mappedProducts: any[],
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    stats: any,
  ): Promise<void> {
    this.logger.log(
      'Starting validation and correction of existing products...',
    );

    try {
      let fixedCount = 0;

      // Create a lookup map for KiotViet product data
      const kiotVietProductLookup = new Map();
      for (const product of mappedProducts) {
        if (product.kiotVietProductId) {
          kiotVietProductLookup.set(
            parseInt(product.kiotVietProductId),
            product,
          );
        }
      }

      // Find all existing products that might need fixing
      // Don't include relations initially to avoid errors with broken foreign keys
      const existingProducts = await tx.product.findMany({
        where: {
          kiotVietProductId: { not: null }, // Only check KiotViet products
        },
      });

      this.logger.log(`Found ${existingProducts.length} products to validate`);

      for (const product of existingProducts) {
        let updated = false;
        const updateData: any = {};

        // Get the original KiotViet data for this product
        const kiotVietData = product.kiotVietProductId
          ? kiotVietProductLookup.get(product.kiotVietProductId)
          : null;

        // Check if business relationship is valid
        const businessExists = await tx.business.findUnique({
          where: { id: product.businessId },
        });

        // Fix missing or incorrect business relationship
        if (kiotVietData && kiotVietData.businessId) {
          const correctBusinessId = businessMap.get(
            parseInt(kiotVietData.businessId),
          );

          if (correctBusinessId && product.businessId !== correctBusinessId) {
            updateData.businessId = correctBusinessId;
            updated = true;

            const business = await tx.business.findUnique({
              where: { id: correctBusinessId },
            });

            this.logger.debug(
              `Fixed business relationship for product ${product.code}: ${businessExists?.name || 'broken'} -> ${business?.name || 'unknown'}`,
            );
          }
        } else if (!businessExists) {
          // If business relationship is broken (businessId points to non-existent business)
          const firstBusinessId = Array.from(businessMap.values())[0];
          if (firstBusinessId) {
            updateData.businessId = firstBusinessId;
            updated = true;
            this.logger.debug(
              `Fixed broken business reference for product ${product.code}`,
            );
          }
        }

        // Check if category relationship is valid
        const categoryExists = await tx.category.findUnique({
          where: { id: product.categoryId },
        });

        // Fix missing or incorrect category relationship
        if (kiotVietData && kiotVietData.categoryId) {
          const correctCategoryId = categoryMap.get(
            parseInt(kiotVietData.categoryId),
          );

          if (correctCategoryId && product.categoryId !== correctCategoryId) {
            updateData.categoryId = correctCategoryId;
            updated = true;

            const category = await tx.category.findUnique({
              where: { id: correctCategoryId },
            });

            this.logger.debug(
              `Fixed category relationship for product ${product.code}: ${categoryExists?.name || 'broken'} -> ${category?.name || 'unknown'}`,
            );
          }
        } else if (!categoryExists) {
          // If category relationship is broken (categoryId points to non-existent category)
          const firstCategoryId = Array.from(categoryMap.values())[0];
          if (firstCategoryId) {
            updateData.categoryId = firstCategoryId;
            updated = true;
            this.logger.debug(
              `Fixed broken category reference for product ${product.code}`,
            );
          }
        }

        // Update the product if we found fixes
        if (updated && Object.keys(updateData).length > 0) {
          await tx.product.update({
            where: { id: product.id },
            data: updateData,
          });

          fixedCount++;
          if (stats.productStats) {
            stats.productStats.updates++;
          }
        }
      }

      this.logger.log(
        `Completed validation and correction: fixed ${fixedCount} products`,
      );
    } catch (error) {
      this.logger.error(
        'Error during product validation and correction:',
        error,
      );
      throw error;
    }
  }

  async createWarehouses(
    tx: any,
    uniqueBranches: Array<{ id: number; name: string }>,
    stats: SyncStats,
  ): Promise<Map<number, string>> {
    const warehouseMap = new Map<number, string>();

    for (const branch of uniqueBranches) {
      try {
        // Check if warehouse already exists
        const existingWarehouse = await tx.warehouse.findUnique({
          where: { kiotVietWarehouseId: parseInt(branch.id.toString()) },
        });

        if (existingWarehouse) {
          warehouseMap.set(branch.id, existingWarehouse.id);
          stats.skips++;
          continue;
        }

        // Generate warehouse data
        const name = this.productUtil.generateWarehouseName(
          branch.name,
          branch.id,
        );
        const code = this.productUtil.generateWarehouseCode(branch.id);

        const warehouse = await tx.warehouse.create({
          data: {
            kiotVietWarehouseId: parseInt(branch.id.toString()),
            name,
            code,
            description: `Kho hàng được đồng bộ từ chi nhánh KiotViet: ${branch.name}`,
            contactNumber: this.productUtil.generateBusinessPhone(),
            isActive: true,
            source: OriginSource.kiotviet,
            address: {
              create: {
                name: 'Địa chỉ kho hàng',
                type: 'warehouse',
                fullName: name,
                phone: this.productUtil.generateBusinessPhone(),
                street: `Địa chỉ chi nhánh ${branch.name}`,
                city: 'Hồ Chí Minh',
                country: 'VN',
                isDefault: true,
              },
            },
          },
        });

        warehouseMap.set(branch.id, warehouse.id);
        stats.adds++;
        this.logger.debug(`Created warehouse: ${name}`);
      } catch (error) {
        this.logger.error(`Failed to create warehouse ${branch.name}:`, error);
        stats.errors++;
      }
    }

    return warehouseMap;
  }

  async createProducts(
    tx: any,
    mappedProducts: any[],
    categoryMap: Map<number, string>,
    businessMap: Map<number, string>,
    warehouseMap: Map<number, string>,
    stats: SyncStats,
    syncDetails?: any, // Full sync details object with all stats
  ): Promise<void> {
    for (const product of mappedProducts) {
      try {
        // Check if product already exists (by KiotViet ID or code)
        const existingProduct = await tx.product.findFirst({
          where: {
            OR: [
              {
                kiotVietProductId:
                  parseInt(product.kiotVietProductId?.toString() || '0') ||
                  null,
              },
              { code: product.code },
            ],
          },
        });

        if (existingProduct) {
          this.logger.debug(`Product already exists: ${product.code}`);
          stats.skips++;
          continue;
        }

        // Get required mappings
        const categoryLookupKey = parseInt(product.categoryId.toString());
        const categoryId = categoryMap.get(categoryLookupKey);

        if (!categoryId) {
          this.logger.debug(
            `Category lookup failed: key=${categoryLookupKey}, product.categoryId=${product.categoryId}, available keys=[${Array.from(categoryMap.keys()).join(', ')}]`,
          );
        }

        // Convert product.businessId back to number to lookup in businessMap
        let businessId: string | undefined;
        if (product.businessId) {
          const tradeMarkId = parseInt(product.businessId.toString());
          businessId = businessMap.get(tradeMarkId);
        }

        if (!categoryId || !businessId) {
          this.logger.error(
            `Missing required dependencies for product ${product.code}: categoryId=${categoryId}, businessId=${businessId}, product.businessId=${product.businessId}, product.businessName=${product.businessName}`,
          );
          stats.errors++;
          continue;
        }

        // Generate product data
        const slug = this.productUtil.generateSlug(product.name, product.code);
        const barcode = this.productUtil.generateBarcode(product.code);

        // Process thumbnail to ensure it's a string
        const thumbnailUrl =
          (typeof product.thumbnail === 'string'
            ? product.thumbnail
            : product.thumbnail?.url) ||
          (typeof product.images?.[0] === 'string'
            ? product.images[0]
            : product.images?.[0]?.url) ||
          'https://via.placeholder.com/300x300?text=No+Image';

        this.logger.debug(
          `Product ${product.code}: thumbnail type=${typeof product.thumbnail}, processed url=${thumbnailUrl}`,
        );

        // Create product
        const newProduct = await tx.product.create({
          data: {
            kiotVietProductId:
              parseInt(product.kiotVietProductId?.toString() || '0') || null,
            masterKiotVietProductId:
              parseInt(product.masterProductId?.toString() || '0') || null,
            masterKiotVietUnitId:
              parseInt(product.masterUnitId?.toString() || '0') || null,
            code: product.code,
            name: product.name,
            barCode: barcode,
            slug,
            description:
              product.description ||
              `Sản phẩm được đồng bộ từ KiotViet: ${product.name}`,
            type: product.type
              ? this.mapProductType(product.type)
              : ProductType.product,
            weight: product.weight,
            source: OriginSource.kiotviet,
            price: product.price || 0,
            basePrice: product.basePrice || 0,
            minQuantity: product.minQuantity || 1,
            maxQuantity: product.maxQuantity,
            thumbnail: thumbnailUrl,
            isActive: product.isActive,
            allowsSale: product.allowsSale,
            specifications: product.specifications
              ? typeof product.specifications === 'string'
                ? product.specifications
                : JSON.stringify(product.specifications)
              : product.attributes &&
                  Array.isArray(product.attributes) &&
                  product.attributes.length > 0
                ? JSON.stringify(product.attributes)
                : null,
            isLotSerialControl: product.isLotSerialControl || false,
            isBatchExpireControl: product.isBatchExpireControl || false,
            isRewardPoint: product.isRewardPoint || false,
            taxType: product.taxType
              ? this.mapTaxType(product.taxType, product.taxRate)
              : null,
            taxRate: product.taxRate,
            taxRateDirect: product.taxRateDirect,
            taxName:
              product.taxname ||
              (product.taxType
                ? this.generateTaxName(
                    this.mapTaxType(product.taxType, product.taxRate),
                  )
                : null),
            unit: product.unit || 'Cái',
            conversionValue: product.conversionValue || 1,
            categoryId,
            businessId,
          },
        });

        // Create default product unit (every product must have at least one unit)
        await this.createDefaultProductUnit(tx, newProduct.id, product);

        // Create product images
        if (product.images && product.images.length > 0) {
          await this.createProductImages(
            tx,
            newProduct.id,
            product.images,
            syncDetails?.productImageStats,
          );
        }

        // Create product inventories
        if (product.inventories && product.inventories.length > 0) {
          await this.createProductInventories(
            tx,
            newProduct.id,
            product.inventories,
            warehouseMap,
            syncDetails?.productInventoryStats,
          );
        }

        // Create product attributes
        if (product.attributes && product.attributes.length > 0) {
          await this.createProductAttributes(
            tx,
            newProduct.id,
            product.attributes,
            syncDetails?.productAttributeStats,
          );
        }

        // Create product units
        if (product.units && product.units.length > 0) {
          await this.createProductUnits(
            tx,
            newProduct.id,
            product.units,
            syncDetails?.productUnitStats,
          );
        }

        // Create product price books
        if (product.priceBooks && product.priceBooks.length > 0) {
          await this.createProductPriceBooks(
            tx,
            newProduct.id,
            product.priceBooks,
            syncDetails?.productPriceBookStats,
          );
        }

        // Create product formulas (for composite products)
        if (product.productFormulas && product.productFormulas.length > 0) {
          await this.createProductFormulas(
            tx,
            newProduct.id,
            product.productFormulas,
            syncDetails?.productFormulaStats,
          );
        }

        // Create product serials (if lot/serial control enabled)
        if (
          product.serials &&
          product.serials.length > 0 &&
          product.isLotSerialControl
        ) {
          await this.createProductSerials(
            tx,
            newProduct.id,
            product.serials,
            warehouseMap,
            syncDetails?.productSerialStats,
          );
        }

        // Create product batch expires (if batch expire control enabled)
        if (
          product.productBatchExpires &&
          product.productBatchExpires.length > 0 &&
          product.isBatchExpireControl
        ) {
          await this.createProductBatchExpires(
            tx,
            newProduct.id,
            product.productBatchExpires,
            warehouseMap,
            syncDetails?.productBatchExpireStats,
          );
        }

        // Create product warranties
        if (product.productWarranties && product.productWarranties.length > 0) {
          await this.createProductWarranties(
            tx,
            newProduct.id,
            product.productWarranties,
            syncDetails?.productWarrantyStats,
          );
        }

        // Create product shelves
        if (product.productShelves && product.productShelves.length > 0) {
          await this.createProductShelves(
            tx,
            newProduct.id,
            product.productShelves,
            warehouseMap,
            syncDetails?.productShelfStats,
          );
        }

        // Create product variants (if hasVariants is true)
        if (
          product.hasVariants &&
          product.variants &&
          product.variants.length > 0
        ) {
          await this.createProductVariants(
            tx,
            newProduct.id,
            product.variants,
            syncDetails?.productVariantStats,
          );
        }

        // Create product order template (if exists)
        if (product.orderTemplate) {
          await this.createProductOrderTemplate(
            tx,
            newProduct.id,
            product.orderTemplate,
            syncDetails?.productOrderTemplateStats,
          );
        }

        stats.adds++;
        this.logger.debug(`Created product: ${product.name}`);
      } catch (error) {
        // Handle specific error types
        if (error.code === 'P2002') {
          // Unique constraint violation - mark as conflict
          this.logger.warn(
            `Product ${product.code} already exists (unique constraint):`,
          );
          stats.conflicts++;
        } else {
          // Other errors
          this.logger.error(`Failed to create product ${product.code}:`, error);
          stats.errors++;
        }
      }
    }
  }

  private async createProductImages(
    tx: any,
    productId: string,
    images: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      try {
        // Extract URL from image object or use string directly
        const imageUrl =
          typeof images[i] === 'string' ? images[i] : images[i]?.url;

        if (!imageUrl) {
          this.logger.warn(
            `Skipping image ${i} for product ${productId}: no valid URL found`,
          );
          continue;
        }

        await tx.productImage.create({
          data: {
            productId,
            url: imageUrl,
            sortOrder:
              typeof images[i] === 'object' ? (images[i]?.sortOrder ?? i) : i,
            isMain:
              typeof images[i] === 'object'
                ? (images[i]?.isMain ?? i === 0)
                : i === 0,
          },
        });
        if (stats) stats.adds++;
      } catch (error) {
        this.logger.error(`Failed to create product image ${i}:`, error);
        if (stats) stats.errors++;
      }
    }
  }

  private async createProductInventories(
    tx: any,
    productId: string,
    inventories: any[],
    warehouseMap: Map<number, string>,
    stats?: SyncStats,
  ): Promise<void> {
    for (const inventory of inventories) {
      try {
        const warehouseId = warehouseMap.get(inventory.branchId);
        if (!warehouseId) {
          this.logger.warn(
            `No warehouse found for branch ${inventory.branchId}`,
          );
          continue;
        }

        await tx.productInventory.create({
          data: {
            kiotVietWarehouseId:
              parseInt(inventory.branchId?.toString() || '0') || null,
            productId,
            warehouseId,
            cost: inventory.cost || 0,
            onHand: inventory.onHand || 0,
            onOrder: inventory.onOrder || 0,
            reserved: inventory.reserved || 0,
            minQuantity: inventory.minQuantity || 0,
            maxQuantity: inventory.maxQuantity,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product inventory:`, error);
      }
    }
  }

  private async createProductAttributes(
    tx: any,
    productId: string,
    attributes: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (const attribute of attributes) {
      try {
        await tx.productAttribute.create({
          data: {
            kiotVietAttributeId:
              parseInt(attribute.id?.toString() || '0') || null,
            productId,
            attributeName: attribute.attributeName,
            attributeValue: attribute.attributeValue,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product attribute:`, error);
      }
    }
  }

  private async createProductUnits(
    tx: any,
    productId: string,
    units: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (const unit of units) {
      try {
        await tx.productUnit.create({
          data: {
            kiotVietUnitId: parseInt(unit.id?.toString() || '0') || null,
            productId,
            code: unit.code,
            name: unit.name,
            unit: unit.unit,
            conversionValue: unit.conversionValue || 1,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product unit:`, error);
      }
    }
  }

  private async createProductPriceBooks(
    tx: any,
    productId: string,
    priceBooks: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (const priceBook of priceBooks) {
      try {
        // First, ensure the PriceBook exists
        let existingPriceBook = await tx.priceBook.findFirst({
          where: {
            kiotVietPriceBookId: parseInt(
              priceBook.priceBookId?.toString() || '0',
            ),
          },
        });

        if (!existingPriceBook) {
          // Create the global PriceBook if it doesn't exist
          existingPriceBook = await tx.priceBook.create({
            data: {
              kiotVietPriceBookId: parseInt(
                priceBook.priceBookId?.toString() || '0',
              ),
              name:
                priceBook.priceBookName || `PriceBook ${priceBook.priceBookId}`,
              description: `Bảng giá được đồng bộ từ KiotViet`,
              price: priceBook.price || 0,
              type: 'product', // Default to product type
              isActive: priceBook.isActive ?? true,
              startDate: priceBook.startDate
                ? new Date(priceBook.startDate)
                : null,
              endDate: priceBook.endDate ? new Date(priceBook.endDate) : null,
              source: OriginSource.kiotviet,
            },
          });
        }

        // Create the ProductPriceBook relationship
        await tx.productPriceBook.create({
          data: {
            kiotVietPriceBookId: parseInt(
              priceBook.priceBookId?.toString() || '0',
            ),
            productId,
            priceBookId: existingPriceBook.id,
            name:
              priceBook.priceBookName || `PriceBook ${priceBook.priceBookId}`,
            price: priceBook.price || 0,
            isActive: priceBook.isActive ?? true,
            startDate: priceBook.startDate
              ? new Date(priceBook.startDate)
              : null,
            endDate: priceBook.endDate ? new Date(priceBook.endDate) : null,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product price book:`, error);
      }
    }
  }

  private async createProductFormulas(
    tx: any,
    productId: string,
    formulas: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (const formula of formulas) {
      try {
        await tx.productFormula.create({
          data: {
            kiotVietMaterialId:
              parseInt(formula.materialId?.toString() || '0') || null,
            kiotVietMaterialCode: formula.materialCode,
            productId,
            materialName: formula.materialName || formula.materialFullName,
            quantity: formula.quantity || 0,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product formula:`, error);
      }
    }
  }

  private async createProductSerials(
    tx: any,
    productId: string,
    serials: any[],
    warehouseMap: Map<number, string>,
    stats?: SyncStats,
  ): Promise<void> {
    for (const serial of serials) {
      try {
        await tx.productSerial.create({
          data: {
            kiotVietSerialId: parseInt(serial.id?.toString() || '0') || null,
            kiotVietProductId:
              parseInt(serial.productId?.toString() || '0') || null,
            kiotVietWarehouseId:
              parseInt(serial.branchId?.toString() || '0') || null,
            productId,
            serialNumber: serial.serialNumber,
            status: serial.status || 0,
            quantity: serial.quantity,
            modifiedDate: serial.modifiedDate
              ? new Date(serial.modifiedDate)
              : null,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product serial:`, error);
      }
    }
  }

  private async createProductBatchExpires(
    tx: any,
    productId: string,
    batchExpires: any[],
    warehouseMap: Map<number, string>,
    stats?: SyncStats,
  ): Promise<void> {
    for (const batchExpire of batchExpires) {
      try {
        const warehouseId = warehouseMap.get(batchExpire.branchId);
        if (!warehouseId) {
          this.logger.warn(
            `No warehouse found for branch ${batchExpire.branchId} in batch expire`,
          );
          continue;
        }

        await tx.productBatchExpire.create({
          data: {
            kiotVietBatchExpireId:
              parseInt(batchExpire.id?.toString() || '0') || null,
            kiotVietProductId:
              parseInt(batchExpire.productId?.toString() || '0') || null,
            kiotVietWarehouseId:
              parseInt(batchExpire.branchId?.toString() || '0') || null,
            productId,
            warehouseId,
            onHand: batchExpire.onHand || 0,
            batchName: batchExpire.batchName,
            expireDate: new Date(batchExpire.expireDate),
            fullNameVirgule: batchExpire.fullNameVirgule,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product batch expire:`, error);
      }
    }
  }

  private async createProductWarranties(
    tx: any,
    productId: string,
    warranties: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (const warranty of warranties) {
      try {
        // Map KiotViet warranty types to ACTA enum values
        const warrantyTypeMap = {
          0: 'none',
          1: 'electronic',
          2: 'manual_ticket',
          3: 'exchange_only',
          4: 'return_only',
          5: 'exchange_and_return',
          6: 'manufacturer_warranty',
          7: 'store_warranty',
          8: 'lifetime',
          9: 'service_included',
        };

        const timeTypeMap = {
          0: 'day',
          1: 'month',
          2: 'year',
        };

        await tx.productWarranty.create({
          data: {
            kiotVietWarrantyId:
              parseInt(warranty.id?.toString() || '0') || null,
            kiotVietProductId:
              parseInt(warranty.productId?.toString() || '0') || null,
            kiotVietTimeType: warranty.timeType,
            kiotVietWarrantyType: warranty.warrantyType,
            productId,
            description:
              warranty.description || 'Bảo hành được đồng bộ từ KiotViet',
            numberTime: warranty.numberTime || 0,
            timeType: timeTypeMap[warranty.timeType] || 'month',
            warrantyType: warrantyTypeMap[warranty.warrantyType] || 'none',
            createdById: warranty.createdBy
              ? warranty.createdBy.toString()
              : null,
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product warranty:`, error);
      }
    }
  }

  private async createProductShelves(
    tx: any,
    productId: string,
    shelves: any[],
    warehouseMap: Map<number, string>,
    stats?: SyncStats,
  ): Promise<void> {
    for (const shelf of shelves) {
      try {
        const warehouseId = warehouseMap.get(shelf.branchId);
        if (!warehouseId) {
          this.logger.warn(
            `No warehouse found for branch ${shelf.branchId} in shelf`,
          );
          continue;
        }

        await tx.productShelf.create({
          data: {
            kiotVietShelfId: parseInt(shelf.id?.toString() || '0') || null,
            kiotVietWarehouseId:
              parseInt(shelf.branchId?.toString() || '0') || null,
            productId,
            warehouseId,
            productShelves: shelf.ProductShelves || '',
            source: OriginSource.kiotviet,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product shelf:`, error);
      }
    }
  }

  private async createProductVariants(
    tx: any,
    productId: string,
    variants: any[],
    stats?: SyncStats,
  ): Promise<void> {
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      try {
        await tx.productVariant.create({
          data: {
            productId,
            name: variant.name || `Variant ${i + 1}`,
            value: variant.value || `Value ${i + 1}`,
            additionalPrice: variant.additionalPrice || 0,
            stock: variant.stock || 0,
            sku: this.productUtil.generateBarcode(`${productId}-variant-${i}`),
          },
        });
      } catch (error) {
        this.logger.error(`Failed to create product variant:`, error);
      }
    }
  }

  private async createProductOrderTemplate(
    tx: any,
    productId: string,
    orderTemplate: string,
    stats?: SyncStats,
  ): Promise<void> {
    try {
      if (orderTemplate && orderTemplate.trim()) {
        await tx.productOrderTemplate.create({
          data: {
            productId,
            name: `Template for Product ${productId}`,
            description: orderTemplate,
            isActive: true,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to create product order template:`, error);
    }
  }

  /**
   * Create default product unit for a product
   * Every product must have at least one unit and a master unit
   */
  private async createDefaultProductUnit(
    tx: any,
    productId: string,
    productData: any,
  ): Promise<void> {
    try {
      // Create the default product unit
      const defaultUnit = await tx.productUnit.create({
        data: {
          kiotVietUnitId: productData.masterUnitId
            ? parseInt(productData.masterUnitId.toString())
            : null,
          code: productData.code || `UNIT-${productId}`,
          name: productData.unit || 'Cái',
          unit: productData.unit || 'Cái',
          conversionValue: productData.conversionValue || 1,
          source: OriginSource.kiotviet,
          productId,
        },
      });

      // Update the product to reference this unit as master unit
      await tx.product.update({
        where: { id: productId },
        data: {
          masterUnitId: defaultUnit.id,
        },
      });

      // Create additional units if provided from KiotViet
      if (
        productData.units &&
        Array.isArray(productData.units) &&
        productData.units.length > 0
      ) {
        for (const unit of productData.units) {
          // Skip if this is the master unit we already created
          if (unit.id === productData.masterUnitId) {
            continue;
          }

          await tx.productUnit.create({
            data: {
              kiotVietUnitId: unit.id ? parseInt(unit.id.toString()) : null,
              code: unit.code || `UNIT-${productId}-${unit.id}`,
              name: unit.name || unit.unit || 'Cái',
              unit: unit.unit || 'Cái',
              conversionValue: unit.conversionValue || 1,
              source: OriginSource.kiotviet,
              productId,
            },
          });
        }
      }

      this.logger.debug(`Created default unit for product ${productId}`);
    } catch (error) {
      this.logger.error(
        `Failed to create default product unit for ${productId}:`,
        error,
      );
    }
  }

  /**
   * Enhanced tax type mapping based on Vietnamese tax system
   * Maps KiotViet tax types to Prisma TaxType enum
   */
  private mapTaxType(taxType: string, taxRate?: string): TaxType {
    // Clean and normalize the input
    const normalizedTaxType = taxType?.toString().trim().toUpperCase();
    const normalizedTaxRate = taxRate?.toString().trim();

    // Direct mapping for specific tax codes
    const directTaxTypeMap: Record<string, TaxType> = {
      KCT: TaxType.kct, // Không chịu thuế
      KKKNT: TaxType.kkknt, // Không kê khai không nộp thuế
      KHAC: TaxType.khac, // Khác
    };

    // Check direct mapping first
    if (normalizedTaxType && directTaxTypeMap[normalizedTaxType]) {
      return directTaxTypeMap[normalizedTaxType];
    }

    // Map based on tax rate percentage
    if (normalizedTaxRate) {
      const rate = parseFloat(normalizedTaxRate);
      if (!isNaN(rate)) {
        if (rate === 0) return TaxType.zero;
        if (rate === 5) return TaxType.five;
        if (rate === 8) return TaxType.eight;
        if (rate === 10) return TaxType.ten;
      }
    }

    // Map based on tax type number/string
    if (normalizedTaxType) {
      if (normalizedTaxType === '0' || normalizedTaxType === 'ZERO')
        return TaxType.zero;
      if (normalizedTaxType === '5' || normalizedTaxType === 'FIVE')
        return TaxType.five;
      if (normalizedTaxType === '8' || normalizedTaxType === 'EIGHT')
        return TaxType.eight;
      if (normalizedTaxType === '10' || normalizedTaxType === 'TEN')
        return TaxType.ten;
    }

    // Default fallback
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
   * Map KiotViet product type to Prisma ProductType enum
   * 1 = combo, 2 = product, 3 = service
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
        return ProductType.product; // Default to product
    }
  }
}
