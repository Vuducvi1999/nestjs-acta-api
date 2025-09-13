import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  PaginatedProductResponseDto,
  ProductItemResponseDto,
} from './dto/product-response.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ProductsHelper } from './products.helper';
import { PRODUCT_CONSTANTS } from './products.constants';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(query?: ProductQueryDto): Promise<PaginatedProductResponseDto> {
    try {
      const cacheKey = ProductsHelper.generateProductsCacheKey(query);
      const cachedData =
        await this.cacheManager.get<PaginatedProductResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query?.page || PRODUCT_CONSTANTS.DEFAULT_PAGE;
      const limit = query?.pageSize || PRODUCT_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      // const where = ProductsHelper.buildProductWhereClause(query);
      const orderBy = ProductsHelper.buildProductOrderBy(query);

      const prismaQuery = {
        orderBy,
        skip,
        take: limit,
        include: ProductsHelper.getProductIncludeClause(),
      };

      const total = await this.prisma.product.count({});
      const products = await this.prisma.product.findMany(prismaQuery);

      const paginatedResponse =
        PaginatedProductResponseDto.fromPaginatedProducts({
          data: products.map((product) =>
            ProductItemResponseDto.fromProduct(product),
          ),
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });

      // Cache the paginated response
      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        PRODUCT_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      ProductsHelper.handleError(error, 'findAll method', this.logger);
    }
  }
}
