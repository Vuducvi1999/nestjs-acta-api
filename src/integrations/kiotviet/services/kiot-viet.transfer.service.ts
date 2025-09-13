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
  KiotVietTransferItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietTransferService {
  private readonly logger = new Logger(KiotVietTransferService.name);

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
      `Error in KiotViet Transfer - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get transfers from KiotViet
   */
  async getTransfers(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietTransferItem>> {
    const cacheKey = `kiotviet:transfers:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedTransfers =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietTransferItem>
      >(cacheKey);

    if (cachedTransfers) {
      this.logger.log(`Returning cached transfers for user ${user.id}`);
      return cachedTransfers;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.TRANSFERS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached transfers for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get transfers');
    }
  }

  /**
   * Get transfer detail by ID
   */
  async getTransferDetail(
    user: JwtPayload,
    transferId: string,
  ): Promise<KiotVietTransferItem> {
    const cacheKey = `kiotviet:transfer:${transferId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedTransfer =
      await this.cacheManager.get<KiotVietTransferItem>(cacheKey);

    if (cachedTransfer) {
      this.logger.log(
        `Returning cached transfer ${transferId} for user ${user.id}`,
      );
      return cachedTransfer;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.TRANSFERS.DETAIL(transferId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached transfer ${transferId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get transfer detail ${transferId}`);
    }
  }

  /**
   * Create new transfer
   */
  async createTransfer(
    user: JwtPayload,
    transferData: Partial<KiotVietTransferItem>,
  ): Promise<KiotVietTransferItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.TRANSFERS.CREATE}`,
          transferData,
          { headers },
        ),
      );

      // Clear transfer cache
      await this.clearTransferCache(user.id);

      this.logger.log(
        `Created transfer: ${transferData.code || transferData.id}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create transfer');
    }
  }

  /**
   * Update transfer
   */
  async updateTransfer(
    user: JwtPayload,
    transferId: string,
    transferData: Partial<KiotVietTransferItem>,
  ): Promise<KiotVietTransferItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.TRANSFERS.UPDATE(transferId)}`,
          transferData,
          { headers },
        ),
      );

      // Clear transfer cache
      await this.clearTransferCache(user.id);

      this.logger.log(`Updated transfer ${transferId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update transfer ${transferId}`);
    }
  }

  /**
   * Delete transfer
   */
  async deleteTransfer(user: JwtPayload, transferId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.TRANSFERS.LIST}/${transferId}`,
          { headers },
        ),
      );

      // Clear transfer cache
      await this.clearTransferCache(user.id);

      this.logger.log(`Deleted transfer ${transferId}`);
    } catch (error) {
      this.handleError(error, `delete transfer ${transferId}`);
    }
  }

  /**
   * Clear transfer cache for user
   */
  async clearTransferCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:transfers:${userId}`,
      `kiotviet:transfer:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared transfer cache for user ${userId}`);
  }
}
