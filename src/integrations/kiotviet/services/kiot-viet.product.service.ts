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
  KiotVietProductItem,
  KiotVietPaginationOptions,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietProductService {
  private readonly logger = new Logger(KiotVietProductService.name);

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
      `Error in KiotViet Product - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get products from KiotViet with pagination support
   */
  async getProducts(
    user: JwtPayload,
    paginationOptions?: KiotVietPaginationOptions,
  ): Promise<KiotVietApiListResponse<KiotVietProductItem>> {
    const cacheKey = `kiotviet:products:${user.id}:${JSON.stringify(paginationOptions || {})}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedProducts =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietProductItem>>(
        cacheKey,
      );

    if (cachedProducts) {
      this.logger.log(`Returning cached products for user ${user.id}`);
      return cachedProducts;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      // Build query parameters
      const params: Record<string, any> = {};
      if (paginationOptions?.currentItem) {
        params.currentItem = paginationOptions.currentItem;
      }
      if (paginationOptions?.pageSize) {
        params.pageSize = paginationOptions.pageSize;
      }
      if (paginationOptions?.orderBy) {
        params.orderBy = paginationOptions.orderBy;
      }
      if (paginationOptions?.orderDirection) {
        params.orderDirection = paginationOptions.orderDirection;
      }
      if (paginationOptions?.includeRemoveIds) {
        params.includeRemoveIds = paginationOptions.includeRemoveIds;
      }

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.LIST}`,
          {
            headers,
            params,
          },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached products for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get products');
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(
    user: JwtPayload,
    productId: string,
  ): Promise<KiotVietProductItem> {
    const cacheKey = `kiotviet:product:${productId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedProduct =
      await this.cacheManager.get<KiotVietProductItem>(cacheKey);

    if (cachedProduct) {
      this.logger.log(
        `Returning cached product ${productId} for user ${user.id}`,
      );
      return cachedProduct;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.DETAIL(productId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached product ${productId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get product ${productId}`);
    }
  }

  /**
   * Search products
   */
  async searchProducts(
    user: JwtPayload,
    query: string,
    limit: number = 20,
  ): Promise<KiotVietApiListResponse<KiotVietProductItem>> {
    const cacheKey = `kiotviet:products:search:${query}:${limit}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedProducts =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietProductItem>>(
        cacheKey,
      );

    if (cachedProducts) {
      this.logger.log(`Returning cached search results for query "${query}"`);
      return cachedProducts;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.LIST}`,
          {
            headers,
            params: {
              searchValue: query,
              pageSize: limit,
            },
          },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached search results for query "${query}"`);

      return response.data;
    } catch (error) {
      this.handleError(error, `search products with query "${query}"`);
    }
  }

  /**
   * Clear product cache for user
   */
  async clearProductCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:products:${userId}`,
      `kiotviet:product:*:${userId}`,
      `kiotviet:products:search:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared product cache for user ${userId}`);
  }

  /**
   * Create product
   */
  async createProduct(
    user: JwtPayload,
    productData: KiotVietProductItem,
  ): Promise<KiotVietProductItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.CREATE}`,
          productData,
          { headers },
        ),
      );

      // Clear product cache
      await this.clearProductCache(user.id);

      return response.data;
    } catch (error) {
      this.handleError(error, 'create product');
    }
  }

  /**
   * Update product
   */
  async updateProduct(
    user: JwtPayload,
    productId: string,
    productData: KiotVietProductItem,
  ): Promise<KiotVietProductItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.UPDATE(productId)}`,
          productData,
          { headers },
        ),
      );

      // Clear product cache
      await this.clearProductCache(user.id);

      return response.data;
    } catch (error) {
      this.handleError(error, `update product ${productId}`);
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(user: JwtPayload, productId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.DELETE(productId)}`,
          { headers },
        ),
      );

      // Clear product cache
      await this.clearProductCache(user.id);
    } catch (error) {
      this.handleError(error, `delete product ${productId}`);
    }
  }

  /**
   * Create list products
   */
  async createListProducts(
    user: JwtPayload,
    productData: KiotVietProductItem[],
  ): Promise<KiotVietProductItem[]> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.PRODUCTS.CREATE_ARRAY}`,
          productData,
          { headers },
        ),
      );

      // Clear product cache
      await this.clearProductCache(user.id);

      return response.data;
    } catch (error) {
      this.handleError(error, 'create list products');
    }
  }
}
