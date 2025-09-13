import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import { JwtPayload } from '../../../auth/jwt-payload';
import { AllConfigType } from '../../../common/configs/types/index.type';
import { PrismaService } from '../../../common/services/prisma.service';
import { IntegrationHelper } from '../../../integrations/integration.helper';
import { Role } from '@prisma/client';

@Injectable()
export class KiotVietService {
  private readonly logger = new Logger(KiotVietService.name);

  private readonly config: {
    apiUrl: string;
    clientId: string;
    clientSecret: string;
    retailerName: string;
    webhookSecret?: string;
  } = {
    apiUrl: '',
    clientId: '',
    clientSecret: '',
    retailerName: '',
    webhookSecret: undefined,
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly helper: IntegrationHelper,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    const kiotvietConfig = this.configService.getOrThrow('kiotviet', {
      infer: true,
    });

    if (!kiotvietConfig) {
      throw new Error(
        'KiotViet configuration is not set in environment variables',
      );
    }

    this.config = {
      apiUrl: kiotvietConfig.apiUrl,
      clientId: kiotvietConfig.clientId,
      clientSecret: kiotvietConfig.clientSecret,
      retailerName: kiotvietConfig.retailerName,
      webhookSecret: kiotvietConfig.webhookSecret,
    };
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in KiotViet Auth - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  /**
   * Get KiotViet AccessToken info
   */
  async getAccessToken(user: JwtPayload): Promise<string> {
    const cacheKey = `kiotviet:accessToken`;

    const cachedToken = await this.cacheManager.get<string>(cacheKey);

    if (cachedToken) {
      return cachedToken;
    }

    const userRole = await this.helper.validateAndGetUserRole(user);

    if (userRole !== Role.admin) {
      throw new UnauthorizedException('Access denied');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://id.kiotviet.vn/connect/token',
          {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            grant_type: 'client_credentials',
            scopes: 'PublicApi.Access',
          },
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      const { access_token, expires_in } = response.data;

      await this.cacheManager.set(cacheKey, access_token, expires_in);

      return access_token;
    } catch (error) {
      this.handleError(error, 'get access token');
    }
  }

  /**
   * Create HTTP headers with authentication
   */
  async createHeaders(user: JwtPayload) {
    const accessToken = await this.getAccessToken(user);

    return {
      Authorization: `Bearer ${accessToken}`,
      Retailer: this.config.retailerName,
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return this.config;
  }
}
