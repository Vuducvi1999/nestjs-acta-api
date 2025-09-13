import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

@Injectable()
export class ApiKeyValidationService {
  private readonly logger = new Logger(ApiKeyValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate KiotViet API key
   * @param apiKey The API key to validate
   * @returns Promise<boolean> True if valid, false otherwise
   */
  async validateKiotVietApiKey(apiKey: string): Promise<boolean> {
    try {
      const config = await this.prisma.kiotVietConfig.findUnique({
        where: { apiKey },
        select: {
          isActive: true,
          systemConfig: {
            select: {
              id: true,
            },
          },
        },
      });

      return config?.isActive === true;
    } catch (error) {
      this.logger.error(
        `Error validating KiotViet API key: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Get KiotViet configuration by API key
   * @param apiKey The API key to find configuration for
   * @returns Promise<KiotVietConfig | null> The configuration if found
   */
  async getKiotVietConfigByApiKey(apiKey: string) {
    try {
      return await this.prisma.kiotVietConfig.findUnique({
        where: { apiKey },
        select: {
          id: true,
          apiKey: true,
          isActive: true,
          fieldMappings: true,
          syncSettings: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error getting KiotViet config by API key: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Validate API key and get configuration
   * @param apiKey The API key to validate
   * @returns Promise<{ isValid: boolean; config?: any }> Validation result and config
   */
  async validateAndGetKiotVietConfig(
    apiKey: string,
  ): Promise<{ isValid: boolean; config?: any }> {
    const isValid = await this.validateKiotVietApiKey(apiKey);

    if (!isValid) {
      return { isValid: false };
    }

    const config = await this.getKiotVietConfigByApiKey(apiKey);
    return { isValid: true, config };
  }

  /**
   * Check if API key exists (regardless of active status)
   * @param apiKey The API key to check
   * @returns Promise<boolean> True if exists, false otherwise
   */
  async apiKeyExists(apiKey: string): Promise<boolean> {
    try {
      const config = await this.prisma.kiotVietConfig.findUnique({
        where: { apiKey },
        select: { id: true },
      });

      return !!config;
    } catch (error) {
      this.logger.error(
        `Error checking API key existence: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Get all active API keys for KiotViet
   * @returns Promise<string[]> Array of active API keys
   */
  async getActiveKiotVietApiKeys(): Promise<string[]> {
    try {
      const configs = await this.prisma.kiotVietConfig.findMany({
        where: { isActive: true },
        select: { apiKey: true },
      });

      return configs.map((config) => config.apiKey);
    } catch (error) {
      this.logger.error(
        `Error getting active API keys: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }
}
