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
import { KiotVietCategoryService } from '../services/kiot-viet.category.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@ApiBearerAuth()
@ApiTags('KiotViet: Categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/categories')
export class KiotVietCategoryController {
  constructor(
    private readonly categoryService: KiotVietCategoryService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Get()
  @Roles(Role.ADMIN)
  async getCategories(@CurrentUser() user: JwtPayload) {
    return this.categoryService.getCategories(user);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getCategoryDetail(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') categoryId: number,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.categoryService.getCategoryDetail(user, categoryId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post()
  async createCategory(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Body() categoryData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.categoryService.createCategory(user, categoryData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Put(':id')
  async updateCategory(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') categoryId: number,
    @Body() categoryData: any,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.categoryService.updateCategory(user, categoryId, categoryData);
  }

  @ApiSecurity('KiotVietApiKey')
  @Delete(':id')
  async deleteCategory(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') categoryId: number,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.categoryService.deleteCategory(user, categoryId);
    return { message: 'Category deleted successfully' };
  }

  @ApiSecurity('KiotVietApiKey')
  @Post('cache/clear')
  async clearCategoryCache(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.categoryService.clearCategoryCache(user.id);
    return { message: 'Category cache cleared successfully' };
  }
}
