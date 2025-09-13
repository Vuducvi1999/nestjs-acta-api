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
  KiotVietCategoryItem,
  KiotVietCategoryDetailItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietCategoryService {
  private readonly logger = new Logger(KiotVietCategoryService.name);

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
      `Error in KiotViet Category - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get categories from KiotViet
   */
  async getCategories(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietCategoryItem>> {
    const cacheKey = `kiotviet:categories:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedCategories =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietCategoryItem>
      >(cacheKey);

    if (cachedCategories) {
      this.logger.log(`Returning cached categories for user ${user.id}`);
      return cachedCategories;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.CATEGORIES.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached categories for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get categories');
    }
  }

  /**
   * Get category detail by ID
   */
  async getCategoryDetail(
    user: JwtPayload,
    categoryId: number,
  ): Promise<KiotVietCategoryDetailItem> {
    const cacheKey = `kiotviet:category:${categoryId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedCategory =
      await this.cacheManager.get<KiotVietCategoryDetailItem>(cacheKey);

    if (cachedCategory) {
      this.logger.log(
        `Returning cached category ${categoryId} for user ${user.id}`,
      );
      return cachedCategory;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.CATEGORIES.DETAIL(
            categoryId.toString(),
          )}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached category ${categoryId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get category detail ${categoryId}`);
    }
  }

  /**
   * Create new category
   */
  async createCategory(
    user: JwtPayload,
    categoryData: Partial<KiotVietCategoryItem>,
  ): Promise<KiotVietCategoryItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.CATEGORIES.CREATE}`,
          categoryData,
          { headers },
        ),
      );

      // Clear category cache
      await this.clearCategoryCache(user.id);

      this.logger.log(`Created category: ${categoryData.categoryName}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create category');
    }
  }

  /**
   * Update category
   */
  async updateCategory(
    user: JwtPayload,
    categoryId: number,
    categoryData: Partial<KiotVietCategoryItem>,
  ): Promise<KiotVietCategoryItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.CATEGORIES.UPDATE(
            categoryId.toString(),
          )}`,
          categoryData,
          { headers },
        ),
      );

      // Clear category cache
      await this.clearCategoryCache(user.id);

      this.logger.log(`Updated category ${categoryId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update category ${categoryId}`);
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(user: JwtPayload, categoryId: number): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.CATEGORIES.DELETE(
            categoryId.toString(),
          )}`,
          { headers },
        ),
      );

      // Clear category cache
      await this.clearCategoryCache(user.id);

      this.logger.log(`Deleted category ${categoryId}`);
    } catch (error) {
      this.handleError(error, `delete category ${categoryId}`);
    }
  }

  /**
   * Clear category cache for user
   */
  async clearCategoryCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:categories:${userId}`,
      `kiotviet:category:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared category cache for user ${userId}`);
  }
}
