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
  KiotVietInvoiceItem,
  KiotVietInvoiceDetailFullItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietInvoiceService {
  private readonly logger = new Logger(KiotVietInvoiceService.name);

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
      `Error in KiotViet Invoice - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get invoices from KiotViet
   */
  async getInvoices(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietInvoiceItem>> {
    const cacheKey = `kiotviet:invoices:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedInvoices =
      await this.cacheManager.get<KiotVietApiListResponse<KiotVietInvoiceItem>>(
        cacheKey,
      );

    if (cachedInvoices) {
      this.logger.log(`Returning cached invoices for user ${user.id}`);
      return cachedInvoices;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.INVOICES.LIST}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached invoices for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get invoices');
    }
  }

  /**
   * Get invoice detail by ID
   */
  async getInvoiceDetail(
    user: JwtPayload,
    invoiceId: string,
  ): Promise<KiotVietInvoiceDetailFullItem> {
    const cacheKey = `kiotviet:invoice:${invoiceId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedInvoice =
      await this.cacheManager.get<KiotVietInvoiceDetailFullItem>(cacheKey);

    if (cachedInvoice) {
      this.logger.log(
        `Returning cached invoice ${invoiceId} for user ${user.id}`,
      );
      return cachedInvoice;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.INVOICES.DETAIL(invoiceId)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached invoice ${invoiceId} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get invoice detail ${invoiceId}`);
    }
  }

  /**
   * Get invoice detail by code
   */
  async getInvoiceDetailByCode(
    user: JwtPayload,
    invoiceCode: string,
  ): Promise<KiotVietInvoiceDetailFullItem> {
    const cacheKey = `kiotviet:invoice:code:${invoiceCode}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedInvoice =
      await this.cacheManager.get<KiotVietInvoiceDetailFullItem>(cacheKey);

    if (cachedInvoice) {
      this.logger.log(
        `Returning cached invoice ${invoiceCode} for user ${user.id}`,
      );
      return cachedInvoice;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.INVOICES.DETAIL_BY_CODE(invoiceCode)}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached invoice ${invoiceCode} for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, `get invoice detail by code ${invoiceCode}`);
    }
  }

  /**
   * Create new invoice
   */
  async createInvoice(
    user: JwtPayload,
    invoiceData: Partial<KiotVietInvoiceItem>,
  ): Promise<KiotVietInvoiceItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.INVOICES.CREATE}`,
          invoiceData,
          { headers },
        ),
      );

      // Clear invoice cache
      await this.clearInvoiceCache(user.id);

      this.logger.log(`Created invoice: ${invoiceData.code || invoiceData.id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'create invoice');
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(
    user: JwtPayload,
    invoiceId: string,
    invoiceData: Partial<KiotVietInvoiceItem>,
  ): Promise<KiotVietInvoiceItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.INVOICES.UPDATE(invoiceId)}`,
          invoiceData,
          { headers },
        ),
      );

      // Clear invoice cache
      await this.clearInvoiceCache(user.id);

      this.logger.log(`Updated invoice ${invoiceId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update invoice ${invoiceId}`);
    }
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(user: JwtPayload, invoiceId: string): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.INVOICES.DELETE}`,
          {
            headers,
            data: { id: invoiceId },
          },
        ),
      );

      // Clear invoice cache
      await this.clearInvoiceCache(user.id);

      this.logger.log(`Deleted invoice ${invoiceId}`);
    } catch (error) {
      this.handleError(error, `delete invoice ${invoiceId}`);
    }
  }

  /**
   * Clear invoice cache for user
   */
  async clearInvoiceCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:invoices:${userId}`,
      `kiotviet:invoice:*:${userId}`,
      `kiotviet:invoice:code:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared invoice cache for user ${userId}`);
  }
}
