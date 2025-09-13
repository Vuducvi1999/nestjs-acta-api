import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  PaginatedPublicBusinessResponseDto,
  PublicBusinessItemResponseDto,
  PublicBusinessDetailDto,
} from './dto/public-business-response.dto';
import { PublicBusinessQueryDto } from './dto/public-business-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PublicBusinessHelper } from './public-businesses.helper';

export const PUBLIC_BUSINESS_CONSTANTS = {
  CACHE_TTL: 10 * 1000, // 10 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 12, // Default to 12 for better grid layouts
} as const;

@Injectable()
export class PublicBusinessService {
  private readonly logger = new Logger(PublicBusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(
    query?: PublicBusinessQueryDto,
  ): Promise<PaginatedPublicBusinessResponseDto> {
    try {
      const cacheKey =
        PublicBusinessHelper.generatePublicBusinessesCacheKey(query);
      const cachedData =
        await this.cacheManager.get<PaginatedPublicBusinessResponseDto>(
          cacheKey,
        );
      if (cachedData) return cachedData;

      const page = query?.page || PUBLIC_BUSINESS_CONSTANTS.DEFAULT_PAGE;
      const limit = query?.pageSize || PUBLIC_BUSINESS_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const where = PublicBusinessHelper.buildPublicBusinessWhereClause(query);
      const orderBy = PublicBusinessHelper.buildPublicBusinessOrderBy(query);

      const prismaQuery = {
        where,
        orderBy,
        skip,
        take: limit,
        include: PublicBusinessHelper.getPublicBusinessIncludeClause(),
      };

      const [total, businesses] = await Promise.all([
        this.prisma.business.count({ where }),
        this.prisma.business.findMany(prismaQuery),
      ]);

      // Transform businesses for public response
      const transformedBusinesses = businesses.map((business) => {
        const transformedBusiness =
          PublicBusinessHelper.transformBusinessForPublicResponse(business);
        return PublicBusinessItemResponseDto.fromBusiness(transformedBusiness);
      });

      const paginatedResponse =
        PaginatedPublicBusinessResponseDto.fromPaginatedBusinesses({
          data: transformedBusinesses,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });

      // Cache the paginated response
      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        PUBLIC_BUSINESS_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      PublicBusinessHelper.handleError(error, 'findAll method', this.logger);
    }
  }

  async findById(id: string): Promise<PublicBusinessDetailDto> {
    try {
      const cacheKey = `public-business-detail:${id}`;
      const cachedData =
        await this.cacheManager.get<PublicBusinessDetailDto>(cacheKey);
      if (cachedData) return cachedData;

      const business = await this.prisma.business.findFirst({
        where: {
          id,
          isActive: true,
        },
        include: PublicBusinessHelper.getDetailedBusinessIncludeClause(),
      });

      if (!business) {
        throw new Error('Business not found');
      }

      const result =
        PublicBusinessHelper.transformBusinessForDetailedResponse(business);

      // Cache the detailed business response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_BUSINESS_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicBusinessHelper.handleError(error, 'findById method', this.logger);
    }
  }

  async findBySlug(slug: string): Promise<PublicBusinessDetailDto> {
    try {
      const cacheKey = `public-business-detail:slug:${slug}`;
      const cachedData =
        await this.cacheManager.get<PublicBusinessDetailDto>(cacheKey);
      if (cachedData) return cachedData;

      const business = await this.prisma.business.findFirst({
        where: {
          slug,
          isActive: true,
        },
        include: PublicBusinessHelper.getDetailedBusinessIncludeClause(),
      });

      if (!business) {
        throw new Error('Business not found');
      }

      const result =
        PublicBusinessHelper.transformBusinessForDetailedResponse(business);

      // Cache the detailed business response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_BUSINESS_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicBusinessHelper.handleError(error, 'findBySlug method', this.logger);
    }
  }

  async getFeatured(
    limit: number = 8,
  ): Promise<PublicBusinessItemResponseDto[]> {
    try {
      const cacheKey = `public-businesses:featured:${limit}`;
      const cachedData =
        await this.cacheManager.get<PublicBusinessItemResponseDto[]>(cacheKey);
      if (cachedData) return cachedData;

      const businesses = await this.prisma.business.findMany({
        where: {
          isActive: true,
          // You might have a 'featured' field or use other criteria
          // isFeatured: true,
        },
        include: PublicBusinessHelper.getPublicBusinessIncludeClause(),
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: limit,
      });

      const transformedBusinesses = businesses.map((business) => {
        const transformedBusiness =
          PublicBusinessHelper.transformBusinessForPublicResponse(business);
        return PublicBusinessItemResponseDto.fromBusiness(transformedBusiness);
      });

      // Cache the featured businesses
      await this.cacheManager.set(
        cacheKey,
        transformedBusinesses,
        PUBLIC_BUSINESS_CONSTANTS.CACHE_TTL,
      );

      return transformedBusinesses;
    } catch (error) {
      PublicBusinessHelper.handleError(
        error,
        'getFeatured method',
        this.logger,
      );
    }
  }
}
