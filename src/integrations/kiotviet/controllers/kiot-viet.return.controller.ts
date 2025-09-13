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
import { KiotVietReturnService } from '../services/kiot-viet.return.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/returns')
export class KiotVietReturnController {
  constructor(
    private readonly returnService: KiotVietReturnService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getReturns(@CurrentUser() user: JwtPayload) {
    return this.returnService.getReturns(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getReturnDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') returnId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.returnService.getReturnDetail(user, returnId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('code/:code')
  async getReturnDetailByCode(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('code') code: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.returnService.getReturnDetailByCode(user, code);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createReturn(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() returnData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.returnService.createReturn(user, returnData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateReturn(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') returnId: string,
    @Body() returnData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    return this.returnService.updateReturn(user, returnId, returnData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteReturn(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') returnId: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }
    await this.returnService.deleteReturn(user, returnId);
    return { message: 'Return deleted successfully' };
  }
}
