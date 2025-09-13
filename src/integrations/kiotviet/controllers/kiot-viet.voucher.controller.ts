import {
  Body,
  Controller,
  Get,
  Post,
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
import { KiotVietVoucherService } from '../services/kiot-viet.voucher.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/vouchers')
export class KiotVietVoucherController {
  constructor(
    private readonly voucherService: KiotVietVoucherService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getVouchers(@CurrentUser() user: JwtPayload) {
    return this.voucherService.getVouchers(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createVoucher(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() voucherData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.voucherService.createVoucher(user, voucherData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post('release')
  async releaseVoucher(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.voucherService.releaseVoucher(user, payload);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post('cancel')
  async cancelVoucher(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.voucherService.cancelVoucher(user, payload);
  }
}
