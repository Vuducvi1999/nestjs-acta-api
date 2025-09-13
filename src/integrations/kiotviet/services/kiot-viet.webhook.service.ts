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
  KiotVietWebhookItem,
  KiotVietWebhookDetailItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietWebhookService {
  private readonly logger = new Logger(KiotVietWebhookService.name);

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
      `Error in KiotViet Webhook - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get webhooks from KiotViet
   */
  async getWebhooks(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietWebhookItem>> {
    const cacheKey = `kiotviet:webhooks:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedWebhooks =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietWebhookItem>>(
        cacheKey,
      );

    if (cachedWebhooks) {
      this.logger.log(`Returning cached webhooks for user ${user.id}`);
      return cachedWebhooks;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.WEBHOOKS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached webhooks for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get webhooks');
    }
  }

  /**
   * Get webhook detail by ID
   */
  async getWebhookDetail(
    user: JwtPayload,
    webhookId: string,
  ): Promise<KiotVietWebhookDetailItem> {
    const cacheKey = `kiotviet:webhook:${webhookId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedWebhook =
      await this.cacheManager.get<KiotVietWebhookDetailItem>(cacheKey);

    if (cachedWebhook) {
      this.logger.log(
        `Returning cached webhook ${webhookId} for user ${user.id}`,
      );
      return cachedWebhook;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.WEBHOOKS.DETAIL(webhookId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached webhook ${webhookId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get webhook detail ${webhookId}`);
    }
  }

  /**
   * Create new webhook
   */
  async createWebhook(
    user: JwtPayload,
    webhookData: Partial<KiotVietWebhookItem>,
  ): Promise<KiotVietWebhookItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.WEBHOOKS.CREATE}`,
          webhookData,
          { headers },
        ),
      );

      // Clear webhook cache
      await this.clearWebhookCache(user.id);

      this.logger.log(
        `Created webhook: ${webhookData.url || webhookData.type}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create webhook');
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    user: JwtPayload,
    webhookId: string,
    webhookData: Partial<KiotVietWebhookItem>,
  ): Promise<KiotVietWebhookItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.WEBHOOKS.LIST}/${webhookId}`,
          webhookData,
          { headers },
        ),
      );

      // Clear webhook cache
      await this.clearWebhookCache(user.id);

      this.logger.log(`Updated webhook ${webhookId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update webhook ${webhookId}`);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(user: JwtPayload, webhookId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.WEBHOOKS.DELETE(webhookId)}`,
          { headers },
        ),
      );

      // Clear webhook cache
      await this.clearWebhookCache(user.id);

      this.logger.log(`Deleted webhook ${webhookId}`);
    } catch (error) {
      this.handleError(error, `delete webhook ${webhookId}`);
    }
  }

  /**
   * Clear webhook cache for user
   */
  async clearWebhookCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:webhooks:${userId}`,
      `kiotviet:webhook:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared webhook cache for user ${userId}`);
  }
}
