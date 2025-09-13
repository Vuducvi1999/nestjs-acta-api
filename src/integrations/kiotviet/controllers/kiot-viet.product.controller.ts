import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { KiotVietApiKey } from '../../../common/decorators/integrations.decorator';
import { JwtPayload } from '../../../auth/jwt-payload';
import { CurrentUser } from '../../../users/users.decorator';
import { ApiKeyValidationService } from '../../api-key-validation.service';
import { KiotVietProductService } from '../services/kiot-viet.product.service';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@ApiBearerAuth()
@ApiTags('KiotViet: Products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations/kiotviet/products')
export class KiotVietProductController {
  constructor(
    private readonly productService: KiotVietProductService,
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @ApiSecurity('KiotVietApiKey')
  @Roles(Role.ADMIN)
  @Get()
  async getProducts(
    @CurrentUser() user: JwtPayload,
    @Query('currentItem') currentItem?: number,
    @Query('pageSize') pageSize?: number,
    @Query('orderBy') orderBy?: string,
    @Query('orderDirection') orderDirection?: 'asc' | 'desc',
    @Query('includeRemoveIds') includeRemoveIds?: boolean,
  ) {
    const paginationOptions = {
      currentItem,
      pageSize,
      orderBy,
      orderDirection,
      includeRemoveIds,
    };

    return this.productService.getProducts(user, paginationOptions);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get('search')
  async searchProducts(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
    @Query('query') query: string,
    @Query('limit') limit: number = 20,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    return this.productService.searchProducts(user, query, limit);
  }

  @ApiSecurity('KiotVietApiKey')
  @Get(':id')
  async getProductById(
    @CurrentUser() user: JwtPayload,
    @Param('id') productId: string,
  ) {
    return this.productService.getProductById(user, productId);
  }

  @ApiSecurity('KiotVietApiKey')
  @Post('cache/clear')
  async clearProductCache(
    @KiotVietApiKey() apiKey: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { isValid } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    await this.productService.clearProductCache(user.id);
    return { message: 'Product cache cleared successfully' };
  }
}
