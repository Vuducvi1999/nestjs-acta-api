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
  KiotVietSupplierItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietSupplierService {
  private readonly logger = new Logger(KiotVietSupplierService.name);

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
      `Error in KiotViet Supplier - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get suppliers from KiotViet
   */
  async getSuppliers(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietSupplierItem>> {
    const cacheKey = `kiotviet:suppliers:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedSuppliers =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietSupplierItem>
      >(cacheKey);

    if (cachedSuppliers) {
      this.logger.log(`Returning cached suppliers for user ${user.id}`);
      return cachedSuppliers;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.SUPPLIERS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached suppliers for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get suppliers');
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(
    user: JwtPayload,
    supplierId: string,
  ): Promise<KiotVietSupplierItem> {
    const cacheKey = `kiotviet:supplier:${supplierId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedSupplier =
      await this.cacheManager.get<KiotVietSupplierItem>(cacheKey);

    if (cachedSupplier) {
      this.logger.log(
        `Returning cached supplier ${supplierId} for user ${user.id}`,
      );
      return cachedSupplier;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.SUPPLIERS.LIST}/${supplierId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached supplier ${supplierId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get supplier ${supplierId}`);
    }
  }

  /**
   * Create new supplier
   */
  async createSupplier(
    user: JwtPayload,
    supplierData: Partial<KiotVietSupplierItem>,
  ): Promise<KiotVietSupplierItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.SUPPLIERS.LIST}`,
          supplierData,
          { headers },
        ),
      );

      // Clear supplier cache
      await this.clearSupplierCache(user.id);

      this.logger.log(
        `Created supplier: ${supplierData.name || supplierData.code}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create supplier');
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(
    user: JwtPayload,
    supplierId: string,
    supplierData: Partial<KiotVietSupplierItem>,
  ): Promise<KiotVietSupplierItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.SUPPLIERS.LIST}/${supplierId}`,
          supplierData,
          { headers },
        ),
      );

      // Clear supplier cache
      await this.clearSupplierCache(user.id);

      this.logger.log(`Updated supplier ${supplierId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update supplier ${supplierId}`);
    }
  }

  /**
   * Delete supplier
   */
  async deleteSupplier(user: JwtPayload, supplierId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.SUPPLIERS.LIST}/${supplierId}`,
          { headers },
        ),
      );

      // Clear supplier cache
      await this.clearSupplierCache(user.id);

      this.logger.log(`Deleted supplier ${supplierId}`);
    } catch (error) {
      this.handleError(error, `delete supplier ${supplierId}`);
    }
  }

  /**
   * Clear supplier cache for user
   */
  async clearSupplierCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:suppliers:${userId}`,
      `kiotviet:supplier:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared supplier cache for user ${userId}`);
  }
}
