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
import { KiotVietPurchaseService } from '../services/kiot-viet.purchase.service';

@ApiBearerAuth()
@ApiTags('KiotViet: PurchaseOrders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/purchaseorders')
export class KiotVietPurchaseController {
  constructor(
    private readonly purchaseService: KiotVietPurchaseService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getPurchaseOrders(@CurrentUser() user: JwtPayload) {
    return this.purchaseService.getPurchaseOrders(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getPurchaseOrderById(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') purchaseOrderId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.purchaseService.getPurchaseOrderById(user, purchaseOrderId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createPurchaseOrder(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() purchaseOrderData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.purchaseService.createPurchaseOrder(user, purchaseOrderData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updatePurchaseOrder(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') purchaseOrderId: string,
    @Body() purchaseOrderData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.purchaseService.updatePurchaseOrder(
      user,
      purchaseOrderId,
      purchaseOrderData,
    );
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deletePurchaseOrder(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') purchaseOrderId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    await this.purchaseService.deletePurchaseOrder(user, purchaseOrderId);
    return { message: 'Purchase order deleted successfully' };
  }
}
