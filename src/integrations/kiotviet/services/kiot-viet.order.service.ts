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
import { KiotVietApiListResponse, KiotVietOrderItem } from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietOrderService {
  private readonly logger = new Logger(KiotVietOrderService.name);

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
      `Error in KiotViet Order - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get orders from KiotViet
   */
  async getOrders(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietOrderItem>> {
    const cacheKey = `kiotviet:orders:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedOrders =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietOrderItem>
      >(cacheKey);

    if (cachedOrders) {
      this.logger.log(`Returning cached orders for user ${user.id}`);
      return cachedOrders;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(`${config.apiUrl}/${API_ENDPOINTS.ORDERS.LIST}`, {
          headers,
        }),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached orders for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get orders');
    }
  }

  /**
   * Get order by code
   */
  async getOrderByCode(
    user: JwtPayload,
    orderCode: string,
  ): Promise<KiotVietOrderItem> {
    const cacheKey = `kiotviet:order:code:${orderCode}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedOrder = await this.cacheManager.get<KiotVietOrderItem>(
      cacheKey,
    );

    if (cachedOrder) {
      this.logger.log(
        `Returning cached order ${orderCode} for user ${user.id}`,
      );
      return cachedOrder;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.ORDERS.DETAIL(orderCode)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached order ${orderCode} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get order by code ${orderCode}`);
    }
  }

  /**
   * Create new order
   */
  async createOrder(
    user: JwtPayload,
    orderData: Partial<KiotVietOrderItem>,
  ): Promise<KiotVietOrderItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.ORDERS.CREATE}`,
          orderData,
          { headers },
        ),
      );

      // Clear order cache
      await this.clearOrderCache(user.id);

      this.logger.log(`Created order: ${orderData.code || orderData.id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create order');
    }
  }

  /**
   * Update order
   */
  async updateOrder(
    user: JwtPayload,
    orderId: string,
    orderData: Partial<KiotVietOrderItem>,
  ): Promise<KiotVietOrderItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.ORDERS.UPDATE(orderId)}`,
          orderData,
          { headers },
        ),
      );

      // Clear order cache
      await this.clearOrderCache(user.id);

      this.logger.log(`Updated order ${orderId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update order ${orderId}`);
    }
  }

  /**
   * Delete order
   */
  async deleteOrder(user: JwtPayload, orderId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.ORDERS.DELETE(orderId)}`,
          { headers },
        ),
      );

      // Clear order cache
      await this.clearOrderCache(user.id);

      this.logger.log(`Deleted order ${orderId}`);
    } catch (error) {
      this.handleError(error, `delete order ${orderId}`);
    }
  }

  /**
   * Get supplier orders
   */
  async getSupplierOrders(user: JwtPayload): Promise<any> {
    const cacheKey = `kiotviet:supplier-orders:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedOrders = await this.cacheManager.get<any>(cacheKey);

    if (cachedOrders) {
      this.logger.log(`Returning cached supplier orders for user ${user.id}`);
      return cachedOrders;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.ORDERS.SUPPLIERS}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached supplier orders for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get supplier orders');
    }
  }

  /**
   * Clear order cache for user
   */
  async clearOrderCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:orders:${userId}`,
      `kiotviet:order:code:*:${userId}`,
      `kiotviet:supplier-orders:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared order cache for user ${userId}`);
  }
}
