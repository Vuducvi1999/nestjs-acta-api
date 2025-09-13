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
import { KiotVietApiListResponse, KiotVietUserItem } from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietUserService {
  private readonly logger = new Logger(KiotVietUserService.name);

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
      `Error in KiotViet User - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get users from KiotViet
   */
  async getUsers(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietUserItem>> {
    const cacheKey = `kiotviet:users:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedUsers =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietUserItem>>(
        cacheKey,
      );

    if (cachedUsers) {
      this.logger.log(`Returning cached users for user ${user.id}`);
      return cachedUsers;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(`${config.apiUrl}/${API_ENDPOINTS.USERS}`, {
          headers,
        }),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached users for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get users');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(
    user: JwtPayload,
    userId: string,
  ): Promise<KiotVietUserItem> {
    const cacheKey = `kiotviet:user:${userId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedUser = await this.cacheManager.get<KiotVietUserItem>(cacheKey);

    if (cachedUser) {
      this.logger.log(`Returning cached user ${userId} for user ${user.id}`);
      return cachedUser;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.USERS}/${userId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached user ${userId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get user ${userId}`);
    }
  }

  /**
   * Create new user
   */
  async createUser(
    user: JwtPayload,
    userData: Partial<KiotVietUserItem>,
  ): Promise<KiotVietUserItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.USERS}`,
          userData,
          { headers },
        ),
      );

      // Clear user cache
      await this.clearUserCache(user.id);

      this.logger.log(
        `Created user: ${userData.userName || userData.givenName}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create user');
    }
  }

  /**
   * Update user
   */
  async updateUser(
    user: JwtPayload,
    userId: string,
    userData: Partial<KiotVietUserItem>,
  ): Promise<KiotVietUserItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.USERS}/${userId}`,
          userData,
          { headers },
        ),
      );

      // Clear user cache
      await this.clearUserCache(user.id);

      this.logger.log(`Updated user ${userId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update user ${userId}`);
    }
  }

  /**
   * Delete user
   */
  async deleteUser(user: JwtPayload, userId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.USERS}/${userId}`,
          { headers },
        ),
      );

      // Clear user cache
      await this.clearUserCache(user.id);

      this.logger.log(`Deleted user ${userId}`);
    } catch (error) {
      this.handleError(error, `delete user ${userId}`);
    }
  }

  /**
   * Clear user cache for user
   */
  async clearUserCache(userId: string): Promise<void> {
    const cacheKeys = [`kiotviet:users:${userId}`, `kiotviet:user:*:${userId}`];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared user cache for user ${userId}`);
  }
}
