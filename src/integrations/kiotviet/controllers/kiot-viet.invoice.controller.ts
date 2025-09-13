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
import { KiotVietInvoiceService } from '../services/kiot-viet.invoice.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/invoices')
export class KiotVietInvoiceController {
  constructor(
    private readonly invoiceService: KiotVietInvoiceService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getInvoices(@CurrentUser() user: JwtPayload) {
    return this.invoiceService.getInvoices(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getInvoiceDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') invoiceId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.invoiceService.getInvoiceDetail(user, invoiceId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('code/:code')
  async getInvoiceDetailByCode(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('code') code: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.invoiceService.getInvoiceDetailByCode(user, code);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createInvoice(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.invoiceService.createInvoice(user, payload);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateInvoice(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.invoiceService.updateInvoice(user, id, payload);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteInvoice(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    await this.invoiceService.deleteInvoice(user, id);
    return { message: 'Invoice deleted successfully' };
  }
}
