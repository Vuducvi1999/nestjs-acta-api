import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  PaginatedPublicProductResponseDto,
  PublicProductItemResponseDto,
  PublicProductDetailDto,
} from './dto/public-product-response.dto';
import { PublicProductQueryDto } from './dto/public-product-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PublicProductHelper } from './public-product.helper';

export const PUBLIC_PRODUCT_CONSTANTS = {
  CACHE_TTL: 10 * 1000, // 10 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12, // Default to 12 for better grid layouts
} as const;

@Injectable()
export class PublicProductService {
  private readonly logger = new Logger(PublicProductService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(
    query?: PublicProductQueryDto,
  ): Promise<PaginatedPublicProductResponseDto> {
    try {
      const cacheKey =
        PublicProductHelper.generatePublicProductsCacheKey(query);
      const cachedData =
        await this.cacheManager.get<PaginatedPublicProductResponseDto>(
          cacheKey,
        );
      if (cachedData) return cachedData;

      const page = query?.page || PUBLIC_PRODUCT_CONSTANTS.DEFAULT_PAGE;
      const limit = query?.pageSize || PUBLIC_PRODUCT_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const where = PublicProductHelper.buildPublicProductWhereClause(query);
      const orderBy = PublicProductHelper.buildPublicProductOrderBy(query);

      const prismaQuery = {
        where,
        orderBy,
        skip,
        take: limit,
        include: PublicProductHelper.getPublicProductIncludeClause(),
      };

      const [total, products] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany(prismaQuery),
      ]);

      // Transform products for public response
      const transformedProducts = products.map((product) => {
        const transformedProduct =
          PublicProductHelper.transformProductForPublicResponse(product);
        return PublicProductItemResponseDto.fromProduct(transformedProduct);
      });

      const paginatedResponse =
        PaginatedPublicProductResponseDto.fromPaginatedProducts({
          data: transformedProducts,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });

      // Cache the paginated response
      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        PUBLIC_PRODUCT_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      PublicProductHelper.handleError(error, 'findAll method', this.logger);
    }
  }

  async findById(id: string): Promise<PublicProductDetailDto> {
    try {
      const cacheKey = `public-product-detail:${id}`;
      const cachedData =
        await this.cacheManager.get<PublicProductDetailDto>(cacheKey);
      if (cachedData) return cachedData;

      const product = await this.prisma.product.findFirst({
        where: {
          id,
          isActive: true,
          allowsSale: true,
        },
        include: PublicProductHelper.getDetailedProductIncludeClause(),
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const result =
        PublicProductHelper.transformProductForDetailedResponse(product);

      // Cache the detailed product response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_PRODUCT_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicProductHelper.handleError(error, 'findById method', this.logger);
    }
  }

  async findBySlug(slug: string): Promise<PublicProductDetailDto> {
    try {
      const cacheKey = `public-product-detail:slug:${slug}`;
      const cachedData =
        await this.cacheManager.get<PublicProductDetailDto>(cacheKey);
      if (cachedData) return cachedData;

      const product = await this.prisma.product.findFirst({
        where: {
          slug,
          isActive: true,
          allowsSale: true,
        },
        include: PublicProductHelper.getDetailedProductIncludeClause(),
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const result =
        PublicProductHelper.transformProductForDetailedResponse(product);

      // Cache the detailed product response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_PRODUCT_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicProductHelper.handleError(error, 'findBySlug method', this.logger);
    }
  }

  async getFeatured(
    limit: number = 8,
  ): Promise<PublicProductItemResponseDto[]> {
    try {
      const cacheKey = `public-products:featured:${limit}`;
      const cachedData =
        await this.cacheManager.get<PublicProductItemResponseDto[]>(cacheKey);
      if (cachedData) return cachedData;

      const products = await this.prisma.product.findMany({
        where: {
          isActive: true,
          allowsSale: true,
          // You might have a 'featured' field or use other criteria
          // isFeatured: true,
        },
        include: PublicProductHelper.getPublicProductIncludeClause(),
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: limit,
      });

      const transformedProducts = products.map((product) => {
        const transformedProduct =
          PublicProductHelper.transformProductForPublicResponse(product);
        return PublicProductItemResponseDto.fromProduct(transformedProduct);
      });

      // Cache the featured products
      await this.cacheManager.set(
        cacheKey,
        transformedProducts,
        PUBLIC_PRODUCT_CONSTANTS.CACHE_TTL,
      );

      return transformedProducts;
    } catch (error) {
      PublicProductHelper.handleError(error, 'getFeatured method', this.logger);
    }
  }
}
