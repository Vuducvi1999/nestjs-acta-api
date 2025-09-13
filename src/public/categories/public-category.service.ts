import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  PaginatedPublicCategoryResponseDto,
  PublicCategoryItemDto,
  PublicCategoryDetailDto,
  PublicCategoryTreeDto,
} from './dto/public-category-response.dto';
import {
  PublicCategoryQueryDto,
  PublicRelatedCategoryDto,
  PublicCategorySuggestDto,
} from './dto/public-category-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PublicCategoryHelper } from './public-category.helper';

export const PUBLIC_CATEGORY_CONSTANTS = {
  CACHE_TTL: 15 * 1000, // 15 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  DEFAULT_TREE_DEPTH: 3,
  DEFAULT_SUGGESTIONS_LIMIT: 10,
  DEFAULT_RELATED_LIMIT: 6,
} as const;

@Injectable()
export class PublicCategoryService {
  private readonly logger = new Logger(PublicCategoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(
    query?: PublicCategoryQueryDto,
  ): Promise<PaginatedPublicCategoryResponseDto> {
    try {
      const cacheKey =
        PublicCategoryHelper.generatePublicCategoriesCacheKey(query);
      const cachedData =
        await this.cacheManager.get<PaginatedPublicCategoryResponseDto>(
          cacheKey,
        );
      if (cachedData) return cachedData;

      const page = query?.page || PUBLIC_CATEGORY_CONSTANTS.DEFAULT_PAGE;
      const limit = query?.pageSize || PUBLIC_CATEGORY_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const where = PublicCategoryHelper.buildPublicCategoryWhereClause(query);
      const orderBy = PublicCategoryHelper.buildPublicCategoryOrderBy(query);

      const prismaQuery = {
        where,
        orderBy,
        skip,
        take: limit,
        include: PublicCategoryHelper.getPublicCategoryIncludeClause(),
      };

      const [total, categories] = await Promise.all([
        this.prisma.category.count({ where }),
        this.prisma.category.findMany(prismaQuery),
      ]);

      // Transform categories for public response
      const transformedCategories = categories.map((category) => {
        const transformedCategory =
          PublicCategoryHelper.transformCategoryForPublicResponse(category);
        return PublicCategoryItemDto.fromCategory(transformedCategory);
      });

      const paginatedResponse =
        PaginatedPublicCategoryResponseDto.fromPaginated({
          data: transformedCategories,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });

      // Cache the paginated response
      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        PUBLIC_CATEGORY_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      PublicCategoryHelper.handleError(error, 'findAll method', this.logger);
    }
  }

  async findById(
    id: string,
    includeFeatured: boolean = false,
  ): Promise<PublicCategoryDetailDto> {
    try {
      const cacheKey = `public-category-detail:${id}:${includeFeatured}`;
      const cachedData =
        await this.cacheManager.get<PublicCategoryDetailDto>(cacheKey);
      if (cachedData) return cachedData;

      const category = await this.prisma.category.findFirst({
        where: {
          id,
          isActive: true,
        },
        include:
          PublicCategoryHelper.getDetailedCategoryIncludeClause(
            includeFeatured,
          ),
      });

      if (!category) {
        throw new Error('Category not found');
      }

      const result =
        PublicCategoryHelper.transformCategoryForDetailedResponse(category);

      // Cache the detailed category response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_CATEGORY_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicCategoryHelper.handleError(error, 'findById method', this.logger);
    }
  }

  async findBySlug(
    slug: string,
    includeFeatured: boolean = false,
  ): Promise<PublicCategoryDetailDto> {
    try {
      const cacheKey = `public-category-detail:slug:${slug}:${includeFeatured}`;
      const cachedData =
        await this.cacheManager.get<PublicCategoryDetailDto>(cacheKey);
      if (cachedData) return cachedData;

      const category = await this.prisma.category.findFirst({
        where: {
          slug,
          isActive: true,
        },
        include:
          PublicCategoryHelper.getDetailedCategoryIncludeClause(
            includeFeatured,
          ),
      });

      if (!category) {
        throw new Error('Category not found');
      }

      const result =
        PublicCategoryHelper.transformCategoryForDetailedResponse(category);

      // Cache the detailed category response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_CATEGORY_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicCategoryHelper.handleError(error, 'findBySlug method', this.logger);
    }
  }

  async getTree(
    withCounts: boolean = false,
    maxDepth: number = PUBLIC_CATEGORY_CONSTANTS.DEFAULT_TREE_DEPTH,
  ): Promise<PublicCategoryTreeDto> {
    try {
      const cacheKey = `public-categories:tree:${withCounts}:${maxDepth}`;
      const cachedData =
        await this.cacheManager.get<PublicCategoryTreeDto>(cacheKey);
      if (cachedData) return cachedData;

      const rootCategories = await this.prisma.category.findMany({
        where: {
          isActive: true,
          isRoot: true,
        },
        include: PublicCategoryHelper.getCategoryTreeIncludeClause(
          withCounts,
          maxDepth,
        ),
        orderBy: { sortOrder: 'asc' },
      });

      const result = PublicCategoryTreeDto.fromCategories(rootCategories, {
        withCounts,
      });

      // Cache the tree response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_CATEGORY_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicCategoryHelper.handleError(error, 'getTree method', this.logger);
    }
  }

  async getSuggestions(
    q?: string,
    limit: number = PUBLIC_CATEGORY_CONSTANTS.DEFAULT_SUGGESTIONS_LIMIT,
  ): Promise<PublicCategorySuggestDto[]> {
    try {
      const cacheKey = `public-categories:suggestions:${q || 'all'}:${limit}`;
      const cachedData =
        await this.cacheManager.get<PublicCategorySuggestDto[]>(cacheKey);
      if (cachedData) return cachedData;

      const where = {
        isActive: true,
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        }),
      };

      const categories = await this.prisma.category.findMany({
        where,
        include: PublicCategoryHelper.getCategorySuggestionsIncludeClause(),
        orderBy: [{ isRoot: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        take: limit,
      });

      const result = categories.map((category) => {
        const transformedCategory =
          PublicCategoryHelper.transformCategoryForSuggestionsResponse(
            category,
          );
        return PublicCategorySuggestDto.fromCategory(transformedCategory);
      });

      // Cache the suggestions response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_CATEGORY_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicCategoryHelper.handleError(
        error,
        'getSuggestions method',
        this.logger,
      );
    }
  }

  async getRelated(
    id: string,
    limit: number = PUBLIC_CATEGORY_CONSTANTS.DEFAULT_RELATED_LIMIT,
  ): Promise<PublicRelatedCategoryDto[]> {
    try {
      const cacheKey = `public-categories:related:${id}:${limit}`;
      const cachedData =
        await this.cacheManager.get<PublicRelatedCategoryDto[]>(cacheKey);
      if (cachedData) return cachedData;

      // First get the current category to find its parent and siblings
      const currentCategory = await this.prisma.category.findFirst({
        where: { id, isActive: true },
        select: { parentId: true, group: true },
      });

      if (!currentCategory) {
        throw new Error('Category not found');
      }

      const where = {
        isActive: true,
        id: { not: id },
        OR: [
          // Same parent (siblings)
          currentCategory.parentId
            ? { parentId: currentCategory.parentId }
            : {},
          // Same group
          { group: currentCategory.group },
          // Root categories if current is root
          currentCategory.parentId === null ? { isRoot: true } : {},
        ].filter((condition) => Object.keys(condition).length > 0),
      };

      const relatedCategories = await this.prisma.category.findMany({
        where,
        include: PublicCategoryHelper.getRelatedCategoryIncludeClause(),
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: limit,
      });

      const result = relatedCategories.map((category) => {
        const transformedCategory =
          PublicCategoryHelper.transformCategoryForRelatedResponse(category);
        return PublicRelatedCategoryDto.fromCategory(transformedCategory);
      });

      // Cache the related categories response
      await this.cacheManager.set(
        cacheKey,
        result,
        PUBLIC_CATEGORY_CONSTANTS.CACHE_TTL,
      );

      return result;
    } catch (error) {
      PublicCategoryHelper.handleError(error, 'getRelated method', this.logger);
    }
  }
}
