import { Controller, Get, HttpStatus, UseGuards, Query } from '@nestjs/common';
import { ProductService } from './products.service';
import { PaginatedProductResponseDto } from './dto/product-response.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiBearerAuth()
@ApiTags('Products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductService) {}

  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Get all products with advanced filtering, sorting, and pagination',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products fetched successfully',
    type: PaginatedProductResponseDto,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query for name, description, or code',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'businessId',
    required: false,
    description: 'Filter by business ID',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Minimum price filter',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Maximum price filter',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'allowsSale',
    required: false,
    description: 'Filter by sale availability',
  })
  @ApiQuery({
    name: 'freeShipping',
    required: false,
    description: 'Filter by free shipping',
  })
  @ApiQuery({
    name: 'isRewardPoint',
    required: false,
    description: 'Filter by reward point eligibility',
  })
  @ApiQuery({
    name: 'taxType',
    required: false,
    description: 'Filter by tax type (comma-separated)',
  })
  @ApiQuery({
    name: 'source',
    required: false,
    description: 'Filter by source (acta, kiotviet)',
  })
  @ApiQuery({
    name: 'categoryGroup',
    required: false,
    description: 'Filter by category group (comma-separated)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Page size (default: 10)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field (name, price, createdAt, updatedAt)',
  })
  @ApiQuery({
    name: 'sortDir',
    required: false,
    description: 'Sort direction (asc, desc)',
  })
  async findAll(
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedProductResponseDto> {
    return this.productsService.findAll(query);
  }
}
