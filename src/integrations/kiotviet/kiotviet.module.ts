import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheConfigService } from '../../common/services/cache-config.service';
import { PrismaService } from '../../common/services/prisma.service';
import { HttpModule } from '@nestjs/axios';
import {
  KiotVietAuthController,
  KiotVietProductController,
  KiotVietCategoryController,
  KiotVietCustomerController,
  KiotVietOrderController,
  KiotVietPriceBookController,
  KiotVietWebhookController,
  KiotVietVoucherController,
  KiotVietUserController,
  KiotVietTransferController,
  KiotVietReturnController,
  KiotVietPurchaseController,
  KiotVietInvoiceController,
  KiotVietBranchController,
  KiotVietProductMappingController,
  KiotVietProductSyncingController,
  KiotVietSyncLogsController,
} from './controllers';
import {
  KiotVietAuthService,
  KiotVietProductService,
  KiotVietCategoryService,
  KiotVietCustomerService,
  KiotVietOrderService,
  KiotVietWebhookService,
  KiotVietVoucherService,
  KiotVietUserService,
  KiotVietTransferService,
  KiotVietReturnService,
  KiotVietPurchaseService,
  KiotVietPriceBookService,
  KiotVietInvoiceService,
  KiotVietBranchService,
} from './services';
import { KiotVietMappingService } from './services/kiotviet-mapping/kiotviet-mapping.product.service';
import { KiotVietConfigService } from './services/kiotviet-config.service';
import { IntegrationHelper } from '../integration.helper';
import { MailService } from '../../mail/mail.service';
import { ActivityLogService } from '../../activity-logs/activity-log.service';
import { ApiKeyValidationService } from '../api-key-validation.service';
import { KiotVietConfigController } from './controllers/kiotviet-config.controller';
import {
  KiotVietProductSyncService,
  KiotVietProductMappingHelper,
  KiotVietProductRelationshipsHelper,
  KiotVietWarehouseHelper,
} from './services/kiotviet-syncing/products';
import { KiotVietSyncingHelpersService } from './services/kiotviet-syncing/kiotviet-syncing-helpers.service';
import { KiotVietProductCrudService } from './services/kiotviet-syncing/products/kiotviet-product-crud.service';
import { KiotVietSyncLogService } from './services/kiotviet-sync-log.service';
import { KiotVietProductUtil } from './utils/kiotviet-product.util';

@Module({
  imports: [
    HttpModule,
    CacheConfigService.register(),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    KiotVietAuthController,
    KiotVietProductController,
    KiotVietCategoryController,
    KiotVietCustomerController,
    KiotVietOrderController,
    KiotVietPriceBookController,
    KiotVietWebhookController,
    KiotVietVoucherController,
    KiotVietUserController,
    KiotVietTransferController,
    KiotVietReturnController,
    KiotVietPurchaseController,
    KiotVietInvoiceController,
    KiotVietBranchController,
    KiotVietConfigController,
    KiotVietProductMappingController,
    KiotVietProductSyncingController,
    KiotVietSyncLogsController,
  ],
  providers: [
    PrismaService,
    KiotVietAuthService,
    KiotVietProductService,
    KiotVietCategoryService,
    KiotVietCustomerService,
    KiotVietOrderService,
    KiotVietWebhookService,
    KiotVietVoucherService,
    KiotVietUserService,
    KiotVietTransferService,
    KiotVietReturnService,
    KiotVietPurchaseService,
    KiotVietPriceBookService,
    KiotVietInvoiceService,
    KiotVietBranchService,
    KiotVietConfigService,
    KiotVietMappingService,
    MailService,
    ActivityLogService,
    IntegrationHelper,
    ApiKeyValidationService,
    // Sync services
    KiotVietProductSyncService,
    KiotVietProductMappingHelper,
    KiotVietProductRelationshipsHelper,
    KiotVietWarehouseHelper,
    KiotVietSyncingHelpersService,
    KiotVietProductCrudService,
    KiotVietSyncLogService,
    KiotVietProductUtil,
  ],
})
export class KiotVietModule {}
