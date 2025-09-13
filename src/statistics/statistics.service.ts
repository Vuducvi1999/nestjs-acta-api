import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Cache } from 'cache-manager';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../common/services/prisma.service';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import {
  CurrentUserStatisticsRankingResponseDto,
  PaginatedStatisticsResponseDto,
  StatisticsPostResponseDto,
  StatisticsUserResponseDto,
} from './dto/statistics-response.dto';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);
  private readonly CACHE_TTL = 10 * 1000; // 10 seconds in milliseconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getStatistics(
    query: StatisticsQueryDto = { view: 'mostReferrals', period: 'month' },
    user: JwtPayload,
  ): Promise<PaginatedStatisticsResponseDto> {
    try {
      const cacheKey = `statistics:${JSON.stringify(query)}:user:${user.referenceId}`;
      const cachedData =
        await this.cacheManager.get<PaginatedStatisticsResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const {
        view = 'mostReferrals',
        period = 'month',
        searchQuery,
        page = 1,
        limit = 10,
      } = query;

      const currentUser = await this.prisma.user.findUnique({
        where: { referenceId: user.referenceId },
        include: {
          avatar: true,
          referrals: true,
          posts: {
            include: {
              reactions: true,
            },
          },
        },
      });
      if (!currentUser) throw new NotFoundException('User not found');

      const fromDate = this.getPeriodStartDate(period);

      let resultData:
        | StatisticsUserResponseDto[]
        | StatisticsPostResponseDto[] = [];
      let total = 0;
      let currentUserStats: CurrentUserStatisticsRankingResponseDto;

      if (view === 'mostSinglePostLikes') {
        const postWhere: Prisma.PostWhereInput = {
          isPublished: true,
          ...(fromDate && { publishedAt: { gte: fromDate } }),
          ...(searchQuery && {
            OR: [
              { content: { contains: searchQuery, mode: 'insensitive' } },
              {
                user: {
                  fullName: { contains: searchQuery, mode: 'insensitive' },
                },
              },
              {
                user: {
                  referenceId: { contains: searchQuery, mode: 'insensitive' },
                },
              },
            ],
          }),
        };

        // First, get ALL posts for global ranking (without search filter)
        const allPostsWithReactions = await this.prisma.post.findMany({
          where: {
            isPublished: true,
            user: {
              deletedAt: null, // Only include posts from non-deleted users
            },
            ...(fromDate && { publishedAt: { gte: fromDate } }),
          },
          include: {
            user: {
              include: {
                avatar: true,
              },
            },
            _count: { select: { reactions: true } },
          },
          orderBy: { reactions: { _count: 'desc' } },
        });

        // Get current user's top post
        const currentUserTopPost = await this.prisma.post.findFirst({
          where: {
            userId: currentUser.id,
            isPublished: true,
            user: {
              deletedAt: null, // Only include posts from non-deleted users
            },
            ...(fromDate && { publishedAt: { gte: fromDate } }),
          },
          include: { _count: { select: { reactions: true } } },
          orderBy: { reactions: { _count: 'desc' } },
        });

        // Get filtered posts for display
        const [posts, count] = await Promise.all([
          this.prisma.post.findMany({
            where: {
              ...postWhere,
              user: {
                deletedAt: null, // Only include posts from non-deleted users
              },
            },
            include: {
              user: {
                include: {
                  avatar: true,
                },
              },
              _count: { select: { reactions: true } },
            },
            orderBy: { reactions: { _count: 'desc' } },
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.post.count({
            where: {
              ...postWhere,
              user: {
                deletedAt: null, // Only count posts from non-deleted users
              },
            },
          }),
        ]);

        // Map to response format with sequential display ranks
        resultData = posts.map((post, index): StatisticsPostResponseDto => {
          return {
            id: post.id,
            title: post.content ?? undefined,
            thumbnailUrl: post.imageUrls?.[0] ?? undefined,
            user: {
              id: post.user.id,
              fullName: post.user.fullName,
              avatarUrl: post.user.avatar?.fileUrl ?? undefined,
              referenceId: post.user.referenceId,
            },
            reactionCount: post._count.reactions,
            rank: (page - 1) * limit + index + 1, // Sequential rank for display
            publishedAt: post.publishedAt ?? new Date(),
          };
        });

        total = count;

        // Calculate current user's rank based on their top post's position
        let currentUserTopPostRank = 0;
        if (currentUserTopPost) {
          const currentUserTopPostLikes = currentUserTopPost._count.reactions;
          // Count posts with more likes than current user's top post
          const postsWithMoreLikes = allPostsWithReactions.filter(
            (post) => post._count.reactions > currentUserTopPostLikes,
          ).length;
          currentUserTopPostRank = postsWithMoreLikes + 1;
        }

        // Calculate user statistics
        const totalReferrals = currentUser.referrals.length;
        const totalPostsReactions = currentUser.posts.reduce(
          (sum, post) => sum + post.reactions.length,
          0,
        );

        currentUserStats = {
          totalReferrals,
          totalPostsReactions,
          totalSinglePostLikes: currentUserTopPost?._count.reactions || 0,
          rank: currentUserTopPostRank, // Global rank for current user's top post
          totalUsers: allPostsWithReactions.length,
          percentage:
            currentUserTopPostRank > 0 && allPostsWithReactions.length > 0
              ? Math.floor(
                  (1 - currentUserTopPostRank / allPostsWithReactions.length) *
                    100,
                )
              : 0,
        };
      } else {
        // Handle mostReferrals and mostPostsReactions views

        // First, get ALL users to calculate proper rankings (without search filter)
        const allUsers = await this.prisma.user.findMany({
          include: {
            avatar: true,
            referrals: true,
            posts: {
              include: {
                reactions: true,
              },
            },
          },
        });

        // Calculate statistics for all users and sort for ranking
        const allUsersWithStats = allUsers.map((user) => ({
          ...user,
          totalReferrals: user.referrals.length,
          totalPostsReactions: user.posts.reduce(
            (sum, post) => sum + post.reactions.length,
            0,
          ),
        }));

        // Sort based on view type for global ranking
        const sortField =
          view === 'mostReferrals' ? 'totalReferrals' : 'totalPostsReactions';
        allUsersWithStats.sort((a, b) => b[sortField] - a[sortField]);

        // Find current user's rank in the global ranking
        const currentUserGlobalRank =
          allUsersWithStats.findIndex((u) => u.id === currentUser.id) + 1;

        // Now apply search filter for display data only
        const userWhere: Prisma.UserWhereInput = {
          ...(searchQuery && {
            OR: [
              { fullName: { contains: searchQuery, mode: 'insensitive' } },
              { referenceId: { contains: searchQuery, mode: 'insensitive' } },
            ],
          }),
        };

        // Get filtered users for display
        const filteredUsers = await this.prisma.user.findMany({
          where: userWhere,
          include: {
            avatar: true,
            referrals: true,
            posts: {
              include: {
                reactions: true,
              },
            },
          },
        });

        // Calculate statistics for filtered users
        const filteredUsersWithStats = filteredUsers.map((user) => ({
          ...user,
          totalReferrals: user.referrals.length,
          totalPostsReactions: user.posts.reduce(
            (sum, post) => sum + post.reactions.length,
            0,
          ),
        }));

        // Sort filtered users
        filteredUsersWithStats.sort((a, b) => b[sortField] - a[sortField]);

        // Paginate filtered results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = filteredUsersWithStats.slice(
          startIndex,
          endIndex,
        );

        // Map to response format with sequential display ranks
        resultData = paginatedUsers.map(
          (user, index): StatisticsUserResponseDto => {
            return {
              id: user.id,
              fullName: user.fullName,
              avatarUrl: user.avatar?.fileUrl ?? undefined,
              status: user.status,
              referenceId: user.referenceId,
              verificationDate: user.verificationDate ?? null,
              role: user.role,
              rank: (page - 1) * limit + index + 1, // Sequential rank for display
              totalReferrals: user.totalReferrals,
              totalPostsReactions: user.totalPostsReactions,
            };
          },
        );

        total = filteredUsersWithStats.length;

        // Calculate user statistics with global ranking
        // Note: For current user stats, we use global ranking across all users
        const totalReferrals = currentUser.referrals.length;
        const totalPostsReactions = currentUser.posts.reduce(
          (sum, post) => sum + post.reactions.length,
          0,
        );

        currentUserStats = {
          totalReferrals,
          totalPostsReactions,
          totalSinglePostLikes: 0, // Not relevant for these views
          rank: currentUserGlobalRank, // Global rank for current user
          totalUsers: allUsersWithStats.length,
          percentage:
            currentUserGlobalRank > 0
              ? Math.floor(
                  (1 - currentUserGlobalRank / allUsersWithStats.length) * 100,
                )
              : 0,
        };
      }

      const result: PaginatedStatisticsResponseDto = {
        data: resultData,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        currentUserStatistics: currentUserStats,
      };

      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      return result;
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      throw error;
    }
  }

  private getPeriodStartDate(period: string): Date | undefined {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        now.setMonth(now.getMonth() - 1);
        return now;
      case 'year':
        now.setFullYear(now.getFullYear() - 1);
        return now;
      default:
        return undefined;
    }
  }
}
