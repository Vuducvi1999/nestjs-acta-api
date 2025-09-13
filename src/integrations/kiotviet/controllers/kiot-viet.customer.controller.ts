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
import { KiotVietCustomerService } from '../services/kiot-viet.customer.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@ApiBearerAuth()
@ApiTags('KiotViet: Customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/customers')
export class KiotVietCustomerController {
  constructor(
    private readonly customerService: KiotVietCustomerService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Get()
  @Roles(Role.ADMIN)
  async getCustomers(@CurrentUser() user: JwtPayload) {
    return this.customerService.getCustomers(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('code/:code')
  async getCustomerByCode(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('code') customerCode: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.customerService.getCustomerByCode(user, customerCode);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('groups')
  async getCustomerGroups(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.customerService.getCustomerGroups(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createCustomer(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() customerData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.customerService.createCustomer(user, customerData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateCustomer(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') customerId: string,
    @Body() customerData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.customerService.updateCustomer(user, customerId, customerData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteCustomer(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') customerId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.customerService.deleteCustomer(user, customerId);
    return { message: 'Customer deleted successfully' };
  }

  @ApiSecurity('KiotVietApiKey')
  @Post('cache/clear')
  async clearCustomerCache(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.customerService.clearCustomerCache(user.id);
    return { message: 'Customer cache cleared successfully' };
  }
}
