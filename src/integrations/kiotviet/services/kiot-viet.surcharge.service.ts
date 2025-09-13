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
  KiotVietSurchargeItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietSurchargeService {
  private readonly logger = new Logger(KiotVietSurchargeService.name);

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
      `Error in KiotViet Surcharge - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get surcharges from KiotViet
   */
  async getSurcharges(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietSurchargeItem>> {
    const cacheKey = `kiotviet:surcharges:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedSurcharges =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietSurchargeItem>
      >(cacheKey);

    if (cachedSurcharges) {
      this.logger.log(`Returning cached surcharges for user ${user.id}`);
      return cachedSurcharges;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.SURCHARGES.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached surcharges for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get surcharges');
    }
  }

  /**
   * Get surcharge by ID
   */
  async getSurchargeById(
    user: JwtPayload,
    surchargeId: string,
  ): Promise<KiotVietSurchargeItem> {
    const cacheKey = `kiotviet:surcharge:${surchargeId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedSurcharge =
      await this.cacheManager.get<KiotVietSurchargeItem>(cacheKey);

    if (cachedSurcharge) {
      this.logger.log(
        `Returning cached surcharge ${surchargeId} for user ${user.id}`,
      );
      return cachedSurcharge;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.SURCHARGES.LIST}/${surchargeId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached surcharge ${surchargeId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get surcharge ${surchargeId}`);
    }
  }

  /**
   * Create new surcharge
   */
  async createSurcharge(
    user: JwtPayload,
    surchargeData: Partial<KiotVietSurchargeItem>,
  ): Promise<KiotVietSurchargeItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.SURCHARGES.CREATE}`,
          surchargeData,
          { headers },
        ),
      );

      // Clear surcharge cache
      await this.clearSurchargeCache(user.id);

      this.logger.log(
        `Created surcharge: ${surchargeData.surchargeName || surchargeData.surchargeCode}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create surcharge');
    }
  }

  /**
   * Update surcharge
   */
  async updateSurcharge(
    user: JwtPayload,
    surchargeId: string,
    surchargeData: Partial<KiotVietSurchargeItem>,
  ): Promise<KiotVietSurchargeItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.SURCHARGES.UPDATE(surchargeId)}`,
          surchargeData,
          { headers },
        ),
      );

      // Clear surcharge cache
      await this.clearSurchargeCache(user.id);

      this.logger.log(`Updated surcharge ${surchargeId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update surcharge ${surchargeId}`);
    }
  }

  /**
   * Activate surcharge
   */
  async activateSurcharge(
    user: JwtPayload,
    surchargeId: string,
  ): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.SURCHARGES.ACTIVE(surchargeId)}`,
          {},
          { headers },
        ),
      );

      // Clear surcharge cache
      await this.clearSurchargeCache(user.id);

      this.logger.log(`Activated surcharge ${surchargeId}`);
    } catch (error) {
      this.handleError(error, `activate surcharge ${surchargeId}`);
    }
  }

  /**
   * Delete surcharge
   */
  async deleteSurcharge(user: JwtPayload, surchargeId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.SURCHARGES.LIST}/${surchargeId}`,
          { headers },
        ),
      );

      // Clear surcharge cache
      await this.clearSurchargeCache(user.id);

      this.logger.log(`Deleted surcharge ${surchargeId}`);
    } catch (error) {
      this.handleError(error, `delete surcharge ${surchargeId}`);
    }
  }

  /**
   * Clear surcharge cache for user
   */
  async clearSurchargeCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:surcharges:${userId}`,
      `kiotviet:surcharge:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared surcharge cache for user ${userId}`);
  }
}
