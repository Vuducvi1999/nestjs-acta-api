import Mux from '@mux/mux-node';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  NewsCategory,
  NewsCommentLike,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { Cache } from 'cache-manager';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { PrismaService } from '../common/services/prisma.service';
import { CreateNewsCommentDto } from './dto/create-comment.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { NewsCommentQueryDto } from './dto/news-comment-query.dto';
import { NewsQueryDto } from './dto/news-query.dto';
import {
  NewsItemResponseDto,
  PaginatedNewsCommentsResponse,
  PaginatedNewsItemResponseDto,
} from './dto/news-response.dto';

import { UpdateNewsCommentDto } from './dto/update-comment.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { messages } from '../constants/messages';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../common/configs/types/index.type';
import { JwtPayload } from '../auth/jwt-payload';
import { ActivityType } from '@prisma/client';
import { NewsTitleDateDto } from './dto/news-title-date.dto';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly CACHE_TTL = 120 * 1000; // 2 minutes in milliseconds
  private readonly video: Mux.Video;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly activityLogService: ActivityLogService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    const muxConfig = this.configService.getOrThrow('mux', {
      infer: true,
    });

    if (!muxConfig) {
      throw new Error('Mux configuration is not set in environment variables');
    }
    const { video } = new Mux({
      tokenId: muxConfig.muxTokenId,
      tokenSecret: muxConfig.muxTokenSecret,
    });
    this.video = video;
  }

  private getSearchCondition(searchQuery: string) {
    return {
      OR: [
        {
          title: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          summary: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          content: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  private buildOrderBy(
    sortBy?: string,
  ): Prisma.NewsItemOrderByWithRelationInput[] {
    const orderBy: Prisma.NewsItemOrderByWithRelationInput[] = [];

    if (sortBy) {
      const [field, order] = sortBy.split(':');
      if (field === 'likes') {
        orderBy.push({
          [field]: { _count: order as Prisma.SortOrder },
        });
      } else {
        orderBy.push({
          [field]: order as Prisma.SortOrder,
        });
      }
    }

    orderBy.push({ title: 'asc' });
    return orderBy;
  }

  private sortBySearchPriority(data: any[], searchQuery: string): any[] {
    const searchTerm = searchQuery.toLowerCase();
    return data.sort((a, b) => {
      const scoreA = this.getSearchPriority(a, searchTerm);
      const scoreB = this.getSearchPriority(b, searchTerm);
      return scoreA - scoreB;
    });
  }

  private getSearchPriority(item: any, searchTerm: string): number {
    if (item.title?.toLowerCase().includes(searchTerm)) return 1;
    if (item.summary?.toLowerCase().includes(searchTerm)) return 2;
    if (item.content?.toLowerCase().includes(searchTerm)) return 3;
    return 4;
  }

  async findAll(
    query: NewsQueryDto = {},
  ): Promise<PaginatedNewsItemResponseDto> {
    try {
      const cacheKey = `news:${JSON.stringify(query)}`;
      const cachedData =
        await this.cacheManager.get<PaginatedNewsItemResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.NewsItemWhereInput = {
        deletedAt: null,
        isPublished: true,
        ...(query.category &&
          query.category === NewsCategory.all && {
            category: { in: [NewsCategory.news, NewsCategory.event] },
          }),
        ...(query.category &&
          query.category !== NewsCategory.all && { category: query.category }),
        ...(query.authorId && { authorId: query.authorId }),
      };

      const orderBy = this.buildOrderBy(query.sortBy);

      const prismaQuery = {
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          likes: true,
          muxData: true,
        },
      };

      if (query.searchQuery) {
        Object.assign(where, this.getSearchCondition(query.searchQuery));
      }

      const [allData, total] = await Promise.all([
        this.prisma.newsItem.findMany(prismaQuery),
        this.prisma.newsItem.count({ where }),
      ]);

      const data = query.searchQuery
        ? this.sortBySearchPriority(allData, query.searchQuery)
        : allData;

      const result = PaginatedNewsItemResponseDto.fromPaginatedResult({
        data,
        total,
        page,
        limit,
      });

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(
        `News items fetched successfully for query: ${JSON.stringify(query)}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error fetching news items:', error);
      throw new InternalServerErrorException('Failed to fetch news items');
    }
  }

  async findAllAdmin(
    query: NewsQueryDto = {},
  ): Promise<PaginatedNewsItemResponseDto> {
    try {
      const cacheKey = `news:admin:${JSON.stringify(query)}`;
      const cachedData =
        await this.cacheManager.get<PaginatedNewsItemResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.NewsItemWhereInput = {
        ...(query.category &&
          query.category !== NewsCategory.all && { category: query.category }),
        ...(query.category &&
          query.category === NewsCategory.all && {
            category: {
              in: [
                NewsCategory.news,
                NewsCategory.event,
                NewsCategory.announcement,
              ],
            },
          }),
        ...(query.authorId && { authorId: query.authorId }),
      };

      const orderBy = this.buildOrderBy(query.sortBy);

      const prismaQuery = {
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          likes: true,
          muxData: true,
        },
      };

      if (query.searchQuery) {
        Object.assign(where, this.getSearchCondition(query.searchQuery));
      }

      const [allData, total] = await Promise.all([
        this.prisma.newsItem.findMany(prismaQuery),
        this.prisma.newsItem.count({ where }),
      ]);

      const data = query.searchQuery
        ? this.sortBySearchPriority(allData, query.searchQuery)
        : allData;

      const result = PaginatedNewsItemResponseDto.fromPaginatedResult({
        data,
        total,
        page,
        limit,
      });

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(
        `News items fetched successfully for query: ${JSON.stringify(query)}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error fetching news items:', error);
      throw new InternalServerErrorException('Failed to fetch news items');
    }
  }

  async findOne(id: string) {
    const cacheKey = `news:${id}`;
    const cachedData =
      await this.cacheManager.get<NewsItemResponseDto>(cacheKey);
    if (cachedData) return cachedData;

    const result = await this.prisma.newsItem.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            fullName: true,
            avatar: true,
            referenceId: true,
          },
        },
        likes: true,
        muxData: true,
      },
    });
    await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
    this.logger.log(`News items fetched successfully for id: ${id}`);
    return result;
  }

  async create(createNewsItemDto: CreateNewsDto, author: JwtPayload) {
    try {
      const newsItem = await this.prisma.$transaction(async (tx) => {
        const { imageUrls, videoUrls, ...rest } = createNewsItemDto;

        // Create news item first
        const newsItem = await tx.newsItem.create({
          data: {
            ...rest,
            authorId: author.id,
            imageUrls: imageUrls || [],
            videoUrls: videoUrls || [],
          },
        });

        // Handle videos upload to Mux
        if (videoUrls && videoUrls.length > 0) {
          try {
            await Promise.all(
              videoUrls.map(async (videoUrl) => {
                const asset = await this.video.assets.create({
                  inputs: [{ url: videoUrl, type: 'video' }],
                  playback_policy: ['public'],
                  test: false,
                  passthrough: `news-item:${newsItem.id}`,
                });

                // Save Mux data to the database
                await tx.muxData.create({
                  data: {
                    assetId: asset.id,
                    playbackId: asset.playback_ids?.[0]?.id,
                    newsItemId: newsItem.id,
                  },
                });
              }),
            );
          } catch (error) {
            this.logger.error(
              `Error uploading video to Mux for news item ${newsItem.id}: ${error.message}`,
              error.stack,
            );
            throw new BadRequestException('Failed to upload video');
          }
        }

        await this.cacheManager.del(`news:${newsItem.id}`);
        await this.activityLogService.createActivityLog(
          newsItem.id,
          'NEWS',
          'NEWS_CREATED',
          author,
          'News item created successfully',
          {
            newsItem: {
              id: newsItem.id,
              title: newsItem.title,
              imageUrls: newsItem.imageUrls,
              videoUrls: newsItem.videoUrls,
            },
          },
        );
        return newsItem;
      });
      this.logger.log(`News item created successfully for author ${author.id}`);
      return newsItem;
    } catch (error) {
      this.logger.error('Error creating news item:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create news item');
    }
  }

  async createMany(createNewsItemDto: CreateNewsDto[], authorId: string) {
    try {
      const newsItems = await this.prisma.newsItem.createMany({
        data: createNewsItemDto.map((dto) => ({
          ...dto,
          authorId,
          imageUrls: dto.imageUrls || [],
          videoUrls: dto.videoUrls || [],
        })),
      });
      this.logger.log(`News items created successfully for author ${authorId}`);
      return newsItems;
    } catch (error) {
      this.logger.error('Error creating news items:', error);
      throw new InternalServerErrorException('Failed to create news items');
    }
  }

  async update(id: string, updateNewsDto: UpdateNewsDto, author: JwtPayload) {
    try {
      const { imageUrls, videoUrls, ...rest } = updateNewsDto;

      const newsItem = await this.prisma.$transaction(async (tx) => {
        // Handle videos update
        if (videoUrls && videoUrls.length > 0) {
          // Delete existing Mux data
          const existingMuxData = await tx.muxData.findMany({
            where: { newsItemId: id },
          });

          // Delete Mux assets
          await Promise.all(
            existingMuxData.map(async (muxData) => {
              try {
                await this.video.assets.delete(muxData.assetId);
              } catch (error) {
                this.logger.warn(
                  `Failed to delete Mux asset ${muxData.assetId}: ${error.message}`,
                );
              }
            }),
          );

          // Delete Mux data records
          await tx.muxData.deleteMany({
            where: { newsItemId: id },
          });

          // Create new Mux data
          try {
            await Promise.all(
              videoUrls.map(async (videoUrl) => {
                const asset = await this.video.assets.create({
                  inputs: [{ url: videoUrl, type: 'video' }],
                  playback_policy: ['public'],
                  test: false,
                  passthrough: `news-item:${id}`,
                });

                await tx.muxData.create({
                  data: {
                    assetId: asset.id,
                    playbackId: asset.playback_ids?.[0]?.id,
                    newsItemId: id,
                  },
                });
              }),
            );
          } catch (error) {
            this.logger.error(
              `Error uploading video to Mux for news item ${id}: ${error.message}`,
              error.stack,
            );
            throw new BadRequestException('Failed to upload video');
          }
        }

        // Update news item
        const updatedNewsItem = await tx.newsItem.update({
          where: { id },
          data: {
            ...rest,
            ...(imageUrls !== undefined && { imageUrls }),
            ...(videoUrls !== undefined && { videoUrls }),
          },
        });

        this.logger.log(`News item updated successfully for news item ${id}`);
        await this.activityLogService.createActivityLog(
          id,
          'NEWS',
          ActivityType.NEWS_UPDATED,
          author,
          'News item updated successfully',
          {
            newsItem: {
              id: updatedNewsItem.id,
              title: updatedNewsItem.title,
              imageUrls: updatedNewsItem.imageUrls,
              videoUrls: updatedNewsItem.videoUrls,
            },
          },
        );
        await this.cacheManager.del(`news:${id}`);
        return updatedNewsItem;
      });

      this.logger.log(`News item updated successfully for news item ${id}`);
      return newsItem;
    } catch (error) {
      this.logger.error('Error updating news item:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update news item');
    }
  }

  async delete(id: string) {
    try {
      const newsItem = await this.prisma.newsItem.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`News item deleted successfully for news item ${id}`);
      return newsItem;
    } catch (error) {
      this.logger.error('Error deleting news item:', error);
      throw new InternalServerErrorException('Failed to delete news item');
    }
  }

  async incrementView(id: string) {
    const newsItem = await this.prisma.newsItem.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
    this.logger.log(`News item viewed successfully for news item ${id}`);
    return newsItem;
  }

  async toggleLike(id: string, userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }

      const existing = await this.prisma.newsLike.findUnique({
        where: { newsItemId_userId: { newsItemId: id, userId } },
      });

      if (existing) {
        await this.prisma.newsLike.delete({
          where: { newsItemId_userId: { newsItemId: id, userId } },
        });
        this.logger.log(`News item unliked: ${id} by user ${userId}`);
        return { toggleLike: false };
      }

      const newLike = await this.prisma.newsLike.create({
        data: { newsItemId: id, userId },
      });
      this.logger.log(`News item liked: ${id} by user ${userId}`);
      return { toggleLike: true, like: newLike, userId };
    } catch (error) {
      this.logger.error('Error toggling like:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to toggle like');
    }
  }

  private async createCommentTransaction(
    tx: Prisma.TransactionClient,
    newsItemId: string,
    userId: string,
    commentDto: CreateNewsCommentDto,
  ) {
    const comment = await tx.newsComment.create({
      data: {
        newsItemId,
        userId,
        content: commentDto.content,
        parentId: commentDto.parentCommentId,
      },
      include: {
        user: {
          select: {
            fullName: true,
            avatar: {
              select: {
                fileUrl: true,
              },
            },
            referenceId: true,
          },
        },
      },
    });

    await tx.newsItem.update({
      where: { id: newsItemId },
      data: { commentCount: { increment: 1 } },
    });

    return comment;
  }

  async addComment(
    id: string,
    userId: string,
    commentDto: CreateNewsCommentDto,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }
      const result = await this.prisma.$transaction((tx) =>
        this.createCommentTransaction(tx, id, userId, commentDto),
      );

      this.logger.log(
        `News item added comment successfully for news item ${id} by user ${userId}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error add comment: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add comment');
    }
  }

  async updateComment(
    commentId: string,
    userId: string,
    commentDto: UpdateNewsCommentDto,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }
      const comment = await this.prisma.newsComment.update({
        where: { id: commentId, userId },
        data: { content: commentDto.content },
      });
      if (!comment) {
        throw new NotFoundException('Comment not found');
      }
      this.logger.log(
        `News item updated comment successfully for comment ${commentId} by user ${userId}`,
      );
      return comment;
    } catch (error) {
      this.logger.error('Error update comment: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update comment');
    }
  }

  async deleteComment(commentId: string, userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }
      const comment = await this.prisma.newsComment.delete({
        where: { id: commentId, userId },
      });
      if (!comment) {
        throw new NotFoundException('Comment not found');
      }
      this.logger.log(
        `News item deleted comment successfully for comment ${commentId} by user ${userId}`,
      );
      return comment;
    } catch (error) {
      this.logger.error('Error delete comment: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete comment');
    }
  }

  async getCommentsPaginated(
    newsItemId: string,
    query: NewsCommentQueryDto = {},
  ): Promise<PaginatedNewsCommentsResponse> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Get total count of root comments
      const totalRootComments = await this.prisma.newsComment.count({
        where: {
          newsItemId,
          parentId: null,
        },
      });

      const rootComments = await this.prisma.newsComment.findMany({
        where: {
          newsItemId,
          parentId: null,
        },
        include: {
          user: {
            select: {
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
          likes: {
            include: {
              user: {
                select: {
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                  referenceId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      const commentsWithMetadata = rootComments.map((comment) => ({
        ...comment,
        replyCount: comment._count?.replies || 0,
        likeCount: comment.likes?.length || 0,
        replies: [],
      }));

      const totalPages = Math.ceil(totalRootComments / limit);

      return {
        data: commentsWithMetadata,
        total: totalRootComments,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      this.logger.error('Error get comments: ', error);
      throw new InternalServerErrorException('Failed to get comments');
    }
  }

  private async handleCommentLike(
    commentId: string,
    userId: string,
    existing: NewsCommentLike | null,
  ) {
    if (existing) {
      await this.prisma.newsCommentLike.delete({
        where: { commentId_userId: { commentId, userId } },
      });
      this.logger.log(
        `News item deleted comment like successfully for comment ${commentId} by user ${userId}`,
      );
      return { toggleLike: false };
    }

    const newCommentLike = await this.prisma.newsCommentLike.create({
      data: { commentId, userId },
    });
    this.logger.log(
      `News item created comment like successfully for comment ${commentId} by user ${userId}`,
    );
    return { toggleLike: true, commentLike: newCommentLike, userId };
  }

  async toggleCommentLike(commentId: string, userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }
      const existing = await this.prisma.newsCommentLike.findUnique({
        where: { commentId_userId: { commentId, userId } },
      });

      return this.handleCommentLike(commentId, userId, existing);
    } catch (error) {
      this.logger.error('Error toggle comment like: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to toggle comment like');
    }
  }

  public async getRepliesComments(newsItemId: string, parentCommentId: string) {
    try {
      const directReplies = await this.prisma.newsComment.findMany({
        where: {
          newsItemId,
          parentId: parentCommentId,
        },
        include: {
          user: {
            select: {
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
          likes: {
            include: {
              user: {
                select: {
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                  referenceId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const repliesWithCount = directReplies.map((reply) => ({
        ...reply,
        replyCount: reply._count?.replies || 0,
        replies: [],
      }));

      return repliesWithCount;
    } catch (error) {
      this.logger.error('Error get replies comments: ', error);
      throw new InternalServerErrorException('Failed to get replies comments');
    }
  }

  async findByTitleAndDate(query: NewsTitleDateDto) {
    try {
      const where: Prisma.NewsItemWhereInput = {
        deletedAt: null,
      };

      if (query.title) {
        where.title = {
          contains: query.title,
          mode: Prisma.QueryMode.insensitive,
        };
      }

      if (query.createdAt) {
        where.createdAt = query.createdAt;
      } else {
        const dateConditions: any = {};

        if (query.createdBefore) {
          dateConditions.lte = query.createdBefore;
        }

        if (query.createdAfter) {
          dateConditions.gte = query.createdAfter;
        }

        if (Object.keys(dateConditions).length > 0) {
          where.createdAt = dateConditions;
        }
      }

      const newsItems = await this.prisma.newsItem.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { title: 'asc' }],
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          likes: true,
          muxData: true,
        },
      });

      return newsItems;
    } catch (error) {
      this.logger.error('Error searching news by title and date:', error);
      throw new InternalServerErrorException(
        'Failed to search news by title and date',
      );
    }
  }

  private parseTitleDateSlug(combinedSlug: string): {
    slug: string;
    timestamp?: Date;
  } {
    // Extract the timestamp from the end of the slug (assuming it's the last numeric part)
    const matches = combinedSlug.match(/^(.+)-(\d+)$/);
    if (!matches) {
      return { slug: combinedSlug };
    }

    const [, slug, timestamp] = matches;
    return {
      slug,
      timestamp: new Date(parseInt(timestamp)),
    };
  }

  async findBySlug(combinedSlug: string) {
    try {
      const { slug, timestamp } = this.parseTitleDateSlug(combinedSlug);

      const where: Prisma.NewsItemWhereInput = {
        deletedAt: null,
        slug: slug,
      };

      if (timestamp) {
        where.createdAt = timestamp;
      }

      const newsItem = await this.prisma.newsItem.findFirst({
        where,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          likes: true,
          muxData: true,
        },
      });

      if (!newsItem) {
        throw new NotFoundException('News item not found');
      }

      return newsItem;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Error searching news by slug:', error);
      throw new InternalServerErrorException('Failed to search news by slug');
    }
  }

  async getLikedNews(
    userId: string,
    query: NewsQueryDto = {},
  ): Promise<PaginatedNewsItemResponseDto> {
    try {
      const cacheKey = `liked-news:${userId}:${JSON.stringify(query)}`;
      const cachedData =
        await this.cacheManager.get<PaginatedNewsItemResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.NewsItemWhereInput = {
        deletedAt: null,
        isPublished: true,
        likes: {
          some: {
            userId: userId,
          },
        },
        ...(query.category &&
          query.category === NewsCategory.all && {
            category: { in: [NewsCategory.news, NewsCategory.event] },
          }),
        ...(query.category &&
          query.category !== NewsCategory.all && { category: query.category }),
        ...(query.authorId && { authorId: query.authorId }),
      };

      const orderBy = this.buildOrderBy(query.sortBy);

      const prismaQuery = {
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          likes: true,
          muxData: true,
        },
      };

      if (query.searchQuery) {
        Object.assign(where, this.getSearchCondition(query.searchQuery));
      }

      const [allData, total] = await Promise.all([
        this.prisma.newsItem.findMany(prismaQuery),
        this.prisma.newsItem.count({ where }),
      ]);

      // If no results found, return empty array
      if (total === 0) {
        const emptyResult = PaginatedNewsItemResponseDto.fromPaginatedResult({
          data: [],
          total: 0,
          page,
          limit,
        });

        await this.cacheManager.set(cacheKey, emptyResult, this.CACHE_TTL);
        this.logger.log(
          `No liked news items found for user ${userId} with query: ${JSON.stringify(query)}`,
        );
        return emptyResult;
      }

      const data = query.searchQuery
        ? this.sortBySearchPriority(allData, query.searchQuery)
        : allData;

      const result = PaginatedNewsItemResponseDto.fromPaginatedResult({
        data,
        total,
        page,
        limit,
      });

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.log(
        `Liked news items fetched successfully for user ${userId} with query: ${JSON.stringify(query)}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error fetching liked news items:', error);
      throw new InternalServerErrorException(
        'Failed to fetch liked news items',
      );
    }
  }
}
