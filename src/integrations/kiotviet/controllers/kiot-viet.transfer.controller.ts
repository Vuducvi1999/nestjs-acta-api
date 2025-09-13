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
import { KiotVietTransferService } from '../services/kiot-viet.transfer.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/transfers')
export class KiotVietTransferController {
  constructor(
    private readonly transferService: KiotVietTransferService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getTransfers(@CurrentUser() user: JwtPayload) {
    return this.transferService.getTransfers(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getTransferDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') transferId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.transferService.getTransferDetail(user, transferId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createTransfer(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() transferData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.transferService.createTransfer(user, transferData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateTransfer(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') transferId: string,
    @Body() transferData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.transferService.updateTransfer(user, transferId, transferData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteTransfer(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') transferId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    await this.transferService.deleteTransfer(user, transferId);
    return { message: 'Transfer deleted successfully' };
  }
}
