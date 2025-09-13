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
  KiotVietVoucherItem,
  KiotVietVoucherCampaignItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietVoucherService {
  private readonly logger = new Logger(KiotVietVoucherService.name);

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
      `Error in KiotViet Voucher - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get vouchers from KiotViet
   */
  async getVouchers(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietVoucherItem>> {
    const cacheKey = `kiotviet:vouchers:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedVouchers =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietVoucherItem>>(
        cacheKey,
      );

    if (cachedVouchers) {
      this.logger.log(`Returning cached vouchers for user ${user.id}`);
      return cachedVouchers;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.VOUCHERS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached vouchers for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get vouchers');
    }
  }

  /**
   * Get voucher campaigns from KiotViet
   */
  async getVoucherCampaigns(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietVoucherCampaignItem>> {
    const cacheKey = `kiotviet:voucher-campaigns:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedCampaigns =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietVoucherCampaignItem>
      >(cacheKey);

    if (cachedCampaigns) {
      this.logger.log(`Returning cached voucher campaigns for user ${user.id}`);
      return cachedCampaigns;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.VOUCHER_CAMPAIGNS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached voucher campaigns for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get voucher campaigns');
    }
  }

  /**
   * Create new voucher
   */
  async createVoucher(
    user: JwtPayload,
    voucherData: Partial<KiotVietVoucherItem>,
  ): Promise<KiotVietVoucherItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.VOUCHERS.CREATE}`,
          voucherData,
          { headers },
        ),
      );

      // Clear voucher cache
      await this.clearVoucherCache(user.id);

      this.logger.log(`Created voucher: ${voucherData.code || voucherData.id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create voucher');
    }
  }

  /**
   * Release voucher
   */
  async releaseVoucher(user: JwtPayload, voucherData: any): Promise<any> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.VOUCHERS.RELEASE}`,
          voucherData,
          { headers },
        ),
      );

      // Clear voucher cache
      await this.clearVoucherCache(user.id);

      this.logger.log(`Released voucher`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'release voucher');
    }
  }

  /**
   * Cancel voucher
   */
  async cancelVoucher(user: JwtPayload, voucherData: any): Promise<any> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.VOUCHERS.CANCEL}`,
          voucherData,
          { headers },
        ),
      );

      // Clear voucher cache
      await this.clearVoucherCache(user.id);

      this.logger.log(`Cancelled voucher`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'cancel voucher');
    }
  }

  /**
   * Clear voucher cache for user
   */
  async clearVoucherCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:vouchers:${userId}`,
      `kiotviet:voucher-campaigns:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared voucher cache for user ${userId}`);
  }
}
