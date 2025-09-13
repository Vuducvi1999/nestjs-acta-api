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
  KiotVietCustomerItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietCustomerService {
  private readonly logger = new Logger(KiotVietCustomerService.name);

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
      `Error in KiotViet Customer - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get customers from KiotViet
   */
  async getCustomers(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietCustomerItem>> {
    const cacheKey = `kiotviet:customers:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedCustomers =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietCustomerItem>
      >(cacheKey);

    if (cachedCustomers) {
      this.logger.log(`Returning cached customers for user ${user.id}`);
      return cachedCustomers;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.CUSTOMERS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached customers for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get customers');
    }
  }

  /**
   * Get customer by code
   */
  async getCustomerByCode(
    user: JwtPayload,
    customerCode: string,
  ): Promise<KiotVietCustomerItem> {
    const cacheKey = `kiotviet:customer:code:${customerCode}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedCustomer =
      await this.cacheManager.get<KiotVietCustomerItem>(cacheKey);

    if (cachedCustomer) {
      this.logger.log(
        `Returning cached customer ${customerCode} for user ${user.id}`,
      );
      return cachedCustomer;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.CUSTOMERS.DETAIL(customerCode)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached customer ${customerCode} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get customer by code ${customerCode}`);
    }
  }

  /**
   * Create new customer
   */
  async createCustomer(
    user: JwtPayload,
    customerData: Partial<KiotVietCustomerItem>,
  ): Promise<KiotVietCustomerItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.CUSTOMERS.CREATE}`,
          customerData,
          { headers },
        ),
      );

      // Clear customer cache
      await this.clearCustomerCache(user.id);

      this.logger.log(
        `Created customer: ${customerData.code || customerData.name}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create customer');
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(
    user: JwtPayload,
    customerId: string,
    customerData: Partial<KiotVietCustomerItem>,
  ): Promise<KiotVietCustomerItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.CUSTOMERS.UPDATE(customerId)}`,
          customerData,
          { headers },
        ),
      );

      // Clear customer cache
      await this.clearCustomerCache(user.id);

      this.logger.log(`Updated customer ${customerId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update customer ${customerId}`);
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(user: JwtPayload, customerId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.CUSTOMERS.DELETE(customerId)}`,
          { headers },
        ),
      );

      // Clear customer cache
      await this.clearCustomerCache(user.id);

      this.logger.log(`Deleted customer ${customerId}`);
    } catch (error) {
      this.handleError(error, `delete customer ${customerId}`);
    }
  }

  /**
   * Get customer groups
   */
  async getCustomerGroups(user: JwtPayload): Promise<any> {
    const cacheKey = `kiotviet:customer-groups:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedGroups = await this.cacheManager.get<any>(cacheKey);

    if (cachedGroups) {
      this.logger.log(`Returning cached customer groups for user ${user.id}`);
      return cachedGroups;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.CUSTOMERS.GROUP}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached customer groups for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get customer groups');
    }
  }

  /**
   * Clear customer cache for user
   */
  async clearCustomerCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:customers:${userId}`,
      `kiotviet:customer:code:*:${userId}`,
      `kiotviet:customer-groups:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared customer cache for user ${userId}`);
  }
}
