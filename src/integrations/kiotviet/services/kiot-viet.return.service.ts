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
  KiotVietReturnOrderItem,
  KiotVietReturnOrderDetailItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietReturnService {
  private readonly logger = new Logger(KiotVietReturnService.name);

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
      `Error in KiotViet Return - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get returns from KiotViet
   */
  async getReturns(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietReturnOrderItem>> {
    const cacheKey = `kiotviet:returns:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedReturns =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietReturnOrderItem>
      >(cacheKey);

    if (cachedReturns) {
      this.logger.log(`Returning cached returns for user ${user.id}`);
      return cachedReturns;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(`${config.apiUrl}/${API_ENDPOINTS.RETURNS.LIST}`, {
          headers,
        }),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached returns for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get returns');
    }
  }

  /**
   * Get return detail by ID
   */
  async getReturnDetail(
    user: JwtPayload,
    returnId: string,
  ): Promise<KiotVietReturnOrderDetailItem> {
    const cacheKey = `kiotviet:return:${returnId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedReturn =
      await this.cacheManager.get<KiotVietReturnOrderDetailItem>(cacheKey);

    if (cachedReturn) {
      this.logger.log(
        `Returning cached return ${returnId} for user ${user.id}`,
      );
      return cachedReturn;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.RETURNS.DETAIL(returnId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached return ${returnId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get return detail ${returnId}`);
    }
  }

  /**
   * Get return detail by code
   */
  async getReturnDetailByCode(
    user: JwtPayload,
    returnCode: string,
  ): Promise<KiotVietReturnOrderDetailItem> {
    const cacheKey = `kiotviet:return:code:${returnCode}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedReturn =
      await this.cacheManager.get<KiotVietReturnOrderDetailItem>(cacheKey);

    if (cachedReturn) {
      this.logger.log(
        `Returning cached return ${returnCode} for user ${user.id}`,
      );
      return cachedReturn;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.RETURNS.DETAIL_BY_CODE(returnCode)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached return ${returnCode} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get return detail by code ${returnCode}`);
    }
  }

  /**
   * Create new return
   */
  async createReturn(
    user: JwtPayload,
    returnData: Partial<KiotVietReturnOrderItem>,
  ): Promise<KiotVietReturnOrderItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.RETURNS.LIST}`,
          returnData,
          { headers },
        ),
      );

      // Clear return cache
      await this.clearReturnCache(user.id);

      this.logger.log(`Created return: ${returnData.code || returnData.id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create return');
    }
  }

  /**
   * Update return
   */
  async updateReturn(
    user: JwtPayload,
    returnId: string,
    returnData: Partial<KiotVietReturnOrderItem>,
  ): Promise<KiotVietReturnOrderItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.RETURNS.LIST}/${returnId}`,
          returnData,
          { headers },
        ),
      );

      // Clear return cache
      await this.clearReturnCache(user.id);

      this.logger.log(`Updated return ${returnId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update return ${returnId}`);
    }
  }

  /**
   * Delete return
   */
  async deleteReturn(user: JwtPayload, returnId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.RETURNS.LIST}/${returnId}`,
          { headers },
        ),
      );

      // Clear return cache
      await this.clearReturnCache(user.id);

      this.logger.log(`Deleted return ${returnId}`);
    } catch (error) {
      this.handleError(error, `delete return ${returnId}`);
    }
  }

  /**
   * Clear return cache for user
   */
  async clearReturnCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:returns:${userId}`,
      `kiotviet:return:*:${userId}`,
      `kiotviet:return:code:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared return cache for user ${userId}`);
  }
}
