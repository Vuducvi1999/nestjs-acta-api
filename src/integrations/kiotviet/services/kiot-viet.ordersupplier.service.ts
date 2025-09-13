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
  KiotVietOrderSupplierItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietOrderSupplierService {
  private readonly logger = new Logger(KiotVietOrderSupplierService.name);

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
      `Error in KiotViet Order Supplier - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get order suppliers from KiotViet
   */
  async getOrderSuppliers(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietOrderSupplierItem>> {
    const cacheKey = `kiotviet:order-suppliers:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedOrderSuppliers =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietOrderSupplierItem>
      >(cacheKey);

    if (cachedOrderSuppliers) {
      this.logger.log(`Returning cached order suppliers for user ${user.id}`);
      return cachedOrderSuppliers;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.ORDER_SUPPLIERS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached order suppliers for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get order suppliers');
    }
  }

  /**
   * Get order supplier detail by ID
   */
  async getOrderSupplierDetail(
    user: JwtPayload,
    orderSupplierId: string,
  ): Promise<KiotVietOrderSupplierItem> {
    const cacheKey = `kiotviet:order-supplier:${orderSupplierId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedOrderSupplier =
      await this.cacheManager.get<KiotVietOrderSupplierItem>(cacheKey);

    if (cachedOrderSupplier) {
      this.logger.log(
        `Returning cached order supplier ${orderSupplierId} for user ${user.id}`,
      );
      return cachedOrderSupplier;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.ORDER_SUPPLIERS.DETAIL(orderSupplierId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(
        `Cached order supplier ${orderSupplierId} for user ${user.id}`,
      );

      return response.data;
    } catch (error) {
      this.handleError(error, `get order supplier detail ${orderSupplierId}`);
    }
  }

  /**
   * Clear order supplier cache for user
   */
  async clearOrderSupplierCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:order-suppliers:${userId}`,
      `kiotviet:order-supplier:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared order supplier cache for user ${userId}`);
  }
}
