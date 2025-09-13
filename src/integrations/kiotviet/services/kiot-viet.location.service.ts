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
  KiotVietLocationItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietLocationService {
  private readonly logger = new Logger(KiotVietLocationService.name);

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
      `Error in KiotViet Location - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get locations from KiotViet
   */
  async getLocations(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietLocationItem>> {
    const cacheKey = `kiotviet:locations:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedLocations =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietLocationItem>
      >(cacheKey);

    if (cachedLocations) {
      this.logger.log(`Returning cached locations for user ${user.id}`);
      return cachedLocations;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.LOCATIONS.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached locations for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get locations');
    }
  }

  /**
   * Get location by ID
   */
  async getLocationById(
    user: JwtPayload,
    locationId: string,
  ): Promise<KiotVietLocationItem> {
    const cacheKey = `kiotviet:location:${locationId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedLocation =
      await this.cacheManager.get<KiotVietLocationItem>(cacheKey);

    if (cachedLocation) {
      this.logger.log(
        `Returning cached location ${locationId} for user ${user.id}`,
      );
      return cachedLocation;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.LOCATIONS.LIST}/${locationId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached location ${locationId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get location ${locationId}`);
    }
  }

  /**
   * Clear location cache for user
   */
  async clearLocationCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:locations:${userId}`,
      `kiotviet:location:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared location cache for user ${userId}`);
  }
}
