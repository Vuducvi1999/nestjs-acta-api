import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { CurrentUser } from '../../../users/users.decorator';
import { JwtPayload } from '../../../auth/jwt-payload';
import { KiotVietApiKey } from '../../../common/decorators/integrations.decorator';
import { ApiKeyValidationService } from '../../api-key-validation.service';
import { KiotVietWebhookService } from '../services/kiot-viet.webhook.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/webhooks')
export class KiotVietWebhookController {
  constructor(
    private readonly webhookService: KiotVietWebhookService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getWebhooks(@CurrentUser() user: JwtPayload) {
    return this.webhookService.getWebhooks(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getWebhookDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') webhookId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.webhookService.getWebhookDetail(user, webhookId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createWebhook(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() webhookData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.webhookService.createWebhook(user, webhookData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateWebhook(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') webhookId: string,
    @Body() webhookData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.webhookService.updateWebhook(user, webhookId, webhookData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteWebhook(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') webhookId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    await this.webhookService.deleteWebhook(user, webhookId);
    return { message: 'Webhook deleted successfully' };
  }
}
