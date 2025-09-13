import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { KiotVietApiKey } from '../../../common/decorators/integrations.decorator';
import { JwtPayload } from '../../../auth/jwt-payload';
import { CurrentUser } from '../../../users/users.decorator';
import { ApiKeyValidationService } from '../../api-key-validation.service';
import { KiotVietOrderService } from '../services/kiot-viet.order.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@ApiBearerAuth()
@ApiTags('KiotViet: Orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/orders')
export class KiotVietOrderController {
  constructor(
    private readonly orderService: KiotVietOrderService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getOrders(@CurrentUser() user: JwtPayload) {
    return this.orderService.getOrders(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('code/:code')
  async getOrderByCode(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('code') orderCode: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.orderService.getOrderByCode(user, orderCode);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('suppliers')
  async getSupplierOrders(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.orderService.getSupplierOrders(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createOrder(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() orderData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.orderService.createOrder(user, orderData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateOrder(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') orderId: string,
    @Body() orderData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.orderService.updateOrder(user, orderId, orderData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteOrder(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') orderId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.orderService.deleteOrder(user, orderId);
    return { message: 'Order deleted successfully' };
  }

  @ApiSecurity('KiotVietApiKey')
  @Post('cache/clear')
  async clearOrderCache(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.orderService.clearOrderCache(user.id);
    return { message: 'Order cache cleared successfully' };
  }
}
