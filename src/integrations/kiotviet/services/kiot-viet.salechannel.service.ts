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
  KiotVietSaleChannelListItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietSaleChannelService {
  private readonly logger = new Logger(KiotVietSaleChannelService.name);

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
      `Error in KiotViet Sale Channel - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get sale channels from KiotViet
   */
  async getSaleChannels(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietSaleChannelListItem>> {
    const cacheKey = `kiotviet:sale-channels:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedSaleChannels =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietSaleChannelListItem>
      >(cacheKey);

    if (cachedSaleChannels) {
      this.logger.log(`Returning cached sale channels for user ${user.id}`);
      return cachedSaleChannels;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.SALE_CHANNELS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached sale channels for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get sale channels');
    }
  }

  /**
   * Clear sale channel cache for user
   */
  async clearSaleChannelCache(userId: string): Promise<void> {
    const cacheKeys = [`kiotviet:sale-channels:${userId}`];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared sale channel cache for user ${userId}`);
  }
}
