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
  KiotVietPriceBookItem,
  KiotVietPriceBookDetailItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietPriceBookService {
  private readonly logger = new Logger(KiotVietPriceBookService.name);

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
      `Error in KiotViet PriceBook - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get price books from KiotViet
   */
  async getPriceBooks(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietPriceBookItem>> {
    const cacheKey = `kiotviet:pricebooks:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedPriceBooks =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietPriceBookItem>
      >(cacheKey);

    if (cachedPriceBooks) {
      this.logger.log(`Returning cached price books for user ${user.id}`);
      return cachedPriceBooks;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PRICEBOOKS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached price books for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get price books');
    }
  }

  /**
   * Get price book detail by ID
   */
  async getPriceBookDetail(
    user: JwtPayload,
    priceBookId: string,
  ): Promise<KiotVietApiListResponse<KiotVietPriceBookDetailItem>> {
    const cacheKey = `kiotviet:pricebook:${priceBookId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedPriceBook =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietPriceBookDetailItem>
      >(cacheKey);

    if (cachedPriceBook) {
      this.logger.log(
        `Returning cached price book ${priceBookId} for user ${user.id}`,
      );
      return cachedPriceBook;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PRICEBOOKS.DETAIL(priceBookId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached price book ${priceBookId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get price book detail ${priceBookId}`);
    }
  }

  /**
   * Update price book detail
   */
  async updatePriceBookDetail(
    user: JwtPayload,
    priceBookDetailData: Partial<KiotVietPriceBookDetailItem>,
  ): Promise<KiotVietPriceBookDetailItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.PRICEBOOKS.UPDATE_DETAIL}`,
          priceBookDetailData,
          { headers },
        ),
      );

      // Clear price book cache
      await this.clearPriceBookCache(user.id);

      this.logger.log(`Updated price book detail`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'update price book detail');
    }
  }

  /**
   * Clear price book cache for user
   */
  async clearPriceBookCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:pricebooks:${userId}`,
      `kiotviet:pricebook:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared price book cache for user ${userId}`);
  }
}
