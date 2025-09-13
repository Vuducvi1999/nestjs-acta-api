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
  KiotVietBankAccountItem,
} from '../../interfaces';
import { API_ENDPOINTS } from '../kiotviet.constants';
import { KiotVietAuthService } from './kiot-viet.auth.service';

@Injectable()
export class KiotVietBankService {
  private readonly logger = new Logger(KiotVietBankService.name);

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
      `Error in KiotViet Bank - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get bank accounts from KiotViet
   */
  async getBankAccounts(
    user: JwtPayload,
  ): Promise<KiotVietApiListResponse<KiotVietBankAccountItem>> {
    const cacheKey = `kiotviet:bank-accounts:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedBankAccounts =
      await this.cacheManager.get<
        KiotVietApiListResponse<KiotVietBankAccountItem>
      >(cacheKey);

    if (cachedBankAccounts) {
      this.logger.log(`Returning cached bank accounts for user ${user.id}`);
      return cachedBankAccounts;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.BANK_ACCOUNTS}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(`Cached bank accounts for user ${user.id}`);

      return response.data;
    } catch (error) {
      this.handleError(error, 'get bank accounts');
    }
  }

  /**
   * Get bank account by ID
   */
  async getBankAccountById(
    user: JwtPayload,
    bankAccountId: string,
  ): Promise<KiotVietBankAccountItem> {
    const cacheKey = `kiotviet:bank-account:${bankAccountId}:${user.id}`;
    const cacheTTL = 300; // 5 minutes cache

    // Check cache first
    const cachedBankAccount =
      await this.cacheManager.get<KiotVietBankAccountItem>(cacheKey);

    if (cachedBankAccount) {
      this.logger.log(
        `Returning cached bank account ${bankAccountId} for user ${user.id}`,
      );
      return cachedBankAccount;
    }

    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.get(
          `${config.apiUrl}/${API_ENDPOINTS.BANK_ACCOUNTS}/${bankAccountId}`,
          { headers },
        ),
      );

      // Cache the response
      await this.cacheManager.set(cacheKey, response.data, cacheTTL);
      this.logger.log(
        `Cached bank account ${bankAccountId} for user ${user.id}`,
      );

      return response.data;
    } catch (error) {
      this.handleError(error, `get bank account ${bankAccountId}`);
    }
  }

  /**
   * Create new bank account
   */
  async createBankAccount(
    user: JwtPayload,
    bankAccountData: Partial<KiotVietBankAccountItem>,
  ): Promise<KiotVietBankAccountItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.post(
          `${config.apiUrl}/${API_ENDPOINTS.BANK_ACCOUNTS}`,
          bankAccountData,
          { headers },
        ),
      );

      // Clear bank account cache
      await this.clearBankAccountCache(user.id);

      this.logger.log(
        `Created bank account: ${bankAccountData.bankName || bankAccountData.accountNumber}`,
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'create bank account');
    }
  }

  /**
   * Update bank account
   */
  async updateBankAccount(
    user: JwtPayload,
    bankAccountId: string,
    bankAccountData: Partial<KiotVietBankAccountItem>,
  ): Promise<KiotVietBankAccountItem> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      const response = await firstValueFrom(
        this.httpService.put(
          `${config.apiUrl}/${API_ENDPOINTS.BANK_ACCOUNTS}/${bankAccountId}`,
          bankAccountData,
          { headers },
        ),
      );

      // Clear bank account cache
      await this.clearBankAccountCache(user.id);

      this.logger.log(`Updated bank account ${bankAccountId}`);
      return response.data;
    } catch (error) {
      this.handleError(error, `update bank account ${bankAccountId}`);
    }
  }

  /**
   * Delete bank account
   */
  async deleteBankAccount(
    user: JwtPayload,
    bankAccountId: string,
  ): Promise<void> {
    try {
      const headers = await this.authService.createHeaders(user);
      const config = this.authService.getConfig();

      await firstValueFrom(
        this.httpService.delete(
          `${config.apiUrl}/${API_ENDPOINTS.BANK_ACCOUNTS}/${bankAccountId}`,
          { headers },
        ),
      );

      // Clear bank account cache
      await this.clearBankAccountCache(user.id);

      this.logger.log(`Deleted bank account ${bankAccountId}`);
    } catch (error) {
      this.handleError(error, `delete bank account ${bankAccountId}`);
    }
  }

  /**
   * Clear bank account cache for user
   */
  async clearBankAccountCache(userId: string): Promise<void> {
    const cacheKeys = [
      `kiotviet:bank-accounts:${userId}`,
      `kiotviet:bank-account:*:${userId}`,
    ];

    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }

    this.logger.log(`Cleared bank account cache for user ${userId}`);
  }
}
