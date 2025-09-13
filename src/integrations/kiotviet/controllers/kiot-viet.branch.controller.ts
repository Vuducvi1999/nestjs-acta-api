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
import { KiotVietBranchService } from '../services/kiot-viet.branch.service';

@ApiBearerAuth()
@ApiTags('KiotViet: Branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/branches')
export class KiotVietBranchController {
  constructor(
    private readonly branchService: KiotVietBranchService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getBranches(@CurrentUser() user: JwtPayload) {
    return this.branchService.getBranches(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getBranchById(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.branchService.getBranchById(user, id);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createBranch(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() payload: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.branchService.createBranch(user, payload);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateBranch(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() payload: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    return this.branchService.updateBranch(user, id, payload);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteBranch(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);
    if (!isValid)
      throw new UnauthorizedException('Invalid or inactive API key');
    await this.branchService.deleteBranch(user, id);
    return { message: 'Branch deleted successfully' };
  }
}
