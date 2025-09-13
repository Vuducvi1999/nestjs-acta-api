export class KiotVietFieldMappingsDto {
  // Core product fields
  id: string;
  code: string;
  name: string;
  fullName: string;
  description: string;

  // Category and brand
  categoryId: string;
  categoryName: string;
  tradeMarkId: string;
  tradeMarkName: string;

  // Pricing and sales
  basePrice: string;
  taxType: string;
  taxRate: string;
  taxname: string;

  // Inventory and control
  weight: string;
  unit: string;
  conversionValue: string;
  isLotSerialControl: string;
  isBatchExpireControl: string;

  // Status and flags
  isActive: string;
  allowsSale: string;
  hasVariants: string;
  type: string;

  // Media and templates
  images: string;
  orderTemplate: string;

  // Metadata
  retailerId: string;
  createdDate: string;
  modifiedDate: string;

  static fromFieldMappings(fieldMappings: any): KiotVietFieldMappingsDto {
    return {
      id: fieldMappings.id || 'id',
      code: fieldMappings.code || 'code',
      name: fieldMappings.name || 'name',
      fullName: fieldMappings.fullName || 'fullName',
      description: fieldMappings.description || 'description',
      categoryId: fieldMappings.categoryId || 'categoryId',
      categoryName: fieldMappings.categoryName || 'categoryName',
      tradeMarkId: fieldMappings.tradeMarkId || 'tradeMarkId',
      tradeMarkName: fieldMappings.tradeMarkName || 'tradeMarkName',
      basePrice: fieldMappings.basePrice || 'basePrice',
      taxType: fieldMappings.taxType || 'taxType',
      taxRate: fieldMappings.taxRate || 'taxRate',
      taxname: fieldMappings.taxname || 'taxname',
      weight: fieldMappings.weight || 'weight',
      unit: fieldMappings.unit || 'unit',
      conversionValue: fieldMappings.conversionValue || 'conversionValue',
      isLotSerialControl:
        fieldMappings.isLotSerialControl || 'isLotSerialControl',
      isBatchExpireControl:
        fieldMappings.isBatchExpireControl || 'isBatchExpireControl',
      isActive: fieldMappings.isActive || 'isActive',
      allowsSale: fieldMappings.allowsSale || 'allowsSale',
      hasVariants: fieldMappings.hasVariants || 'hasVariants',
      type: fieldMappings.type || 'type',
      images: fieldMappings.images || 'images',
      orderTemplate: fieldMappings.orderTemplate || 'orderTemplate',
      retailerId: fieldMappings.retailerId || 'retailerId',
      createdDate: fieldMappings.createdDate || 'createdDate',
      modifiedDate: fieldMappings.modifiedDate || 'modifiedDate',
    };
  }
}

export class KiotVietSyncSettingsDto {
  autoSync: boolean;
  syncInterval: number; // in seconds
  syncProducts: boolean;
  syncCustomers: boolean;
  syncOrders: boolean;
  syncCategories: boolean;
  lastSync: Date | null;
  retryAttempts: number;
  retryDelay: number; // in milliseconds

  static fromSyncSettings(syncSettings: any): KiotVietSyncSettingsDto {
    return {
      autoSync: syncSettings.autoSync || false,
      syncInterval: syncSettings.syncInterval || 3600,
      syncProducts: syncSettings.syncProducts || false,
      syncCustomers: syncSettings.syncCustomers || false,
      syncOrders: syncSettings.syncOrders || false,
      syncCategories: syncSettings.syncCategories || false,
      lastSync: syncSettings.lastSync ? new Date(syncSettings.lastSync) : null,
      retryAttempts: syncSettings.retryAttempts || 3,
      retryDelay: syncSettings.retryDelay || 5000,
    };
  }
}

export class KiotVietConfigResponseDto {
  id: string;
  // apiKey: string; // Removed for security purposes
  isActive: boolean;
  fieldMappings: KiotVietFieldMappingsDto;
  syncSettings: KiotVietSyncSettingsDto;
  systemConfigId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<KiotVietConfigResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(kiotVietConfig: any): KiotVietConfigResponseDto {
    return {
      id: kiotVietConfig.id,
      // apiKey: kiotVietConfig.apiKey, // Removed for security purposes
      isActive: kiotVietConfig.isActive,
      fieldMappings: KiotVietFieldMappingsDto.fromFieldMappings(
        kiotVietConfig.fieldMappings,
      ),
      syncSettings: KiotVietSyncSettingsDto.fromSyncSettings(
        kiotVietConfig.syncSettings,
      ),
      systemConfigId: kiotVietConfig.systemConfigId,
      createdAt: kiotVietConfig.createdAt,
      updatedAt: kiotVietConfig.updatedAt,
    };
  }
}
