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
import { KiotVietApiListResponse, KiotVietBranchItem } from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietBranchService {
  private readonly logger = new Logger(KiotVietBranchService.name);

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
      `Error in KiotViet Branch - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get branches from KiotViet
   */
  async getBranches(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietBranchItem>> {
    const cacheKey = `kiotviet:branches:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedBranches =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietBranchItem>>(
        cacheKey,
      );

    if (cachedBranches) {
      this.logger.log(`Returning cached branches for user ${user.id}`);
      return cachedBranches;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(`${config.apiUrl}/${API_ENDPOINTS.BRANCHES}`, {
          headers,
        }),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached branches for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get branches');
    }
  }

  /**
   * Get branch by ID
   */
  async getBranchById(
    user: JwtPayload,
    branchId: string,
  ): Promise<KiotVietBranchItem> {
    const cacheKey = `kiotviet:branch:${branchId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedBranch =
      await this.cacheManager.get<KiotVietBranchItem>(cacheKey);

    if (cachedBranch) {
      this.logger.log(
        `Returning cached branch ${branchId} for user ${user.id}`,
      );
      return cachedBranch;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.BRANCHES}/${branchId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached branch ${branchId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get branch ${branchId}`);
    }
  }

  /**
   * Create new branch
   */
  async createBranch(
    user: JwtPayload,
    branchData: Partial<KiotVietBranchItem>,
  ): Promise<KiotVietBranchItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.BRANCHES}`,
          branchData,
          { headers },
        ),
      );

      // Clear branch cache
      await this.clearBranchCache(user.id);

      this.logger.log(
        `Created branch: ${branchData.branchName || branchData.id}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create branch');
    }
  }

  /**
   * Update branch
   */
  async updateBranch(
    user: JwtPayload,
    branchId: string,
    branchData: Partial<KiotVietBranchItem>,
  ): Promise<KiotVietBranchItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.BRANCHES}/${branchId}`,
          branchData,
          { headers },
        ),
      );

      // Clear branch cache
      await this.clearBranchCache(user.id);

      this.logger.log(`Updated branch ${branchId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update branch ${branchId}`);
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(user: JwtPayload, branchId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.BRANCHES}/${branchId}`,
          { headers },
        ),
      );

      // Clear branch cache
      await this.clearBranchCache(user.id);

      this.logger.log(`Deleted branch ${branchId}`);
    } catch (error) {
      this.handleError(error, `delete branch ${branchId}`);
    }
  }

  /**
   * Clear branch cache for user
   */
  async clearBranchCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:branches:${userId}`,
      `kiotviet:branch:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared branch cache for user ${userId}`);
  }
}
