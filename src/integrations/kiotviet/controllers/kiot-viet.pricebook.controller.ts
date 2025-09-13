import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
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
import { KiotVietPriceBookService } from '../services/kiot-viet.pricebook.service';

@ApiBearerAuth()
@ApiTags('KiotViet: PriceBooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/pricebooks')
export class KiotVietPriceBookController {
  constructor(
    private readonly priceBookService: KiotVietPriceBookService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getPriceBooks(@CurrentUser() user: JwtPayload) {
    return this.priceBookService.getPriceBooks(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getPriceBookDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') priceBookId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.priceBookService.getPriceBookDetail(user, priceBookId);
  }

  // Update price book detail (KiotViet expects payload at /pricebooks/detail)
  @ApiSecurity('KiotVietApiKey')
  @Put('detail')
  async updatePriceBookDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() priceBookDetailData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.priceBookService.updatePriceBookDetail(
      user,
      priceBookDetailData,
    );
  }
}
