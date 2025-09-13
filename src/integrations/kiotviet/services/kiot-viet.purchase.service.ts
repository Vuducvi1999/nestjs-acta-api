import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { JwtPayload } from '../../../auth/jwt-payload';
import {
  KiotVietApiListResponse,
  KiotVietPurchaseOrderItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietPurchaseService {
  private readonly logger = new Logger(KiotVietPurchaseService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: KiotVietAuthService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Handle errors consistently
   */
  private handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in KiotViet Purchase - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get purchase orders from KiotViet
   */
  async getPurchaseOrders(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietPurchaseOrderItem>> {
    const cacheKey = `kiotviet:purchase-orders:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedPurchaseOrders =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietPurchaseOrderItem>
      >(cacheKey);

    if (cachedPurchaseOrders) {
      this.logger.log(`Returning cached purchase orders for user ${user.id}`);
      return cachedPurchaseOrders;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PURCHASE_ORDERS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached purchase orders for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get purchase orders');
    }
  }

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrderById(
    user: JwtPayload,
    purchaseOrderId: string,
  ): Promise<KiotVietPurchaseOrderItem> {
    const cacheKey = `kiotviet:purchase-order:${purchaseOrderId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedPurchaseOrder =
      await this.cacheManager.get<KiotVietPurchaseOrderItem>(cacheKey);

    if (cachedPurchaseOrder) {
      this.logger.log(
        `Returning cached purchase order ${purchaseOrderId} for user ${user.id}`,
      );
      return cachedPurchaseOrder;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PURCHASE_ORDERS.LIST}/${purchaseOrderId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(
        `Cached purchase order ${purchaseOrderId} for user ${user.id}`,
      );

      return response.data;
    } catch (error) {
      this.handleError(error, `get purchase order ${purchaseOrderId}`);
    }
  }

  /**
   * Create new purchase order
   */
  async createPurchaseOrder(
    user: JwtPayload,
    purchaseOrderData: Partial<KiotVietPurchaseOrderItem>,
  ): Promise<KiotVietPurchaseOrderItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.PURCHASE_ORDERS.CREATE}`,
          purchaseOrderData,
          { headers },
        ),
      );

      // Clear purchase order cache
      await this.clearPurchaseOrderCache(user.id);

      this.logger.log(
        `Created purchase order: ${purchaseOrderData.code || purchaseOrderData.id}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create purchase order');
    }
  }

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(
    user: JwtPayload,
    purchaseOrderId: string,
    purchaseOrderData: Partial<KiotVietPurchaseOrderItem>,
  ): Promise<KiotVietPurchaseOrderItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.PURCHASE_ORDERS.UPDATE(purchaseOrderId)}`,
          purchaseOrderData,
          { headers },
        ),
      );

      // Clear purchase order cache
      await this.clearPurchaseOrderCache(user.id);

      this.logger.log(`Updated purchase order ${purchaseOrderId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update purchase order ${purchaseOrderId}`);
    }
  }

  /**
   * Delete purchase order
   */
  async deletePurchaseOrder(
    user: JwtPayload,
    purchaseOrderId: string,
  ): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.PURCHASE_ORDERS.DELETE(purchaseOrderId)}`,
          { headers },
        ),
      );

      // Clear purchase order cache
      await this.clearPurchaseOrderCache(user.id);

      this.logger.log(`Deleted purchase order ${purchaseOrderId}`);
    } catch (error) {
      this.handleError(error, `delete purchase order ${purchaseOrderId}`);
    }
  }

  /**
   * Clear purchase order cache for user
   */
  async clearPurchaseOrderCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:purchase-orders:${userId}`,
      `kiotviet:purchase-order:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared purchase order cache for user ${userId}`);
  }
}
