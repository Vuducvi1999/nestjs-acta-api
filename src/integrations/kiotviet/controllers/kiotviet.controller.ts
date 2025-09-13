import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { KiotVietApiKey } from '../../../common/decorators/integrations.decorator';
import { JwtPayload } from '../../../auth/jwt-payload';
import { CurrentUser } from '../../../users/users.decorator';
import { ApiKeyValidationService } from '../../api-key-validation.service';
import { KiotVietService } from '../services/kiotviet.service';

@ApiBearerAuth()
@ApiTags('KiotViet')
@UseGuards(JwtAuthGuard)
@Controller('integrations/kiotviet')
export class KiotVietController {
  constructor(
    private readonly kiotVietService: KiotVietService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Get('access-token')
  async getAccessToken(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.kiotVietService.getAccessToken(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('config')
  async getConfig(@KiotVietApiKey() apiKey: string) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.kiotVietService.getConfig();
  }

  /**
   * Validate KiotViet API key
   * @param apiKey The API key to validate
   * @returns Validation result
   */
  @ApiSecurity('KiotVietApiKey')
  @Post('validate-api-key')
  async validateApiKey(@KiotVietApiKey() apiKey: string) {
    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    const isValid =
      await this.apiKeyValidationService.validateKiotVietApiKey(apiKey);
    const config =
      await this.apiKeyValidationService.getKiotVietConfigByApiKey(apiKey);

    return {
      isValid,
      hasConfig: !!config,
      message: isValid ? 'API key is valid' : 'API key is invalid or inactive',
    };
  }

  /**
   * Get API key information
   * @param apiKey The API key to get information for
   * @returns API key information
   */
  @ApiSecurity('KiotVietApiKey')
  @Post('api-key-info')
  async getApiKeyInfo(@KiotVietApiKey() apiKey: string) {
    if (!apiKey) {
      throw new BadRequestException('API key is required');
    }

    const exists = await this.apiKeyValidationService.apiKeyExists(apiKey);
    const isValid =
      await this.apiKeyValidationService.validateKiotVietApiKey(apiKey);
    const config =
      await this.apiKeyValidationService.getKiotVietConfigByApiKey(apiKey);

    return {
      exists,
      isValid,
      hasConfig: !!config,
      isActive: config?.isActive || false,
      message: exists
        ? isValid
          ? 'API key is valid and active'
          : 'API key exists but is inactive'
        : 'API key does not exist',
    };
  }
}
