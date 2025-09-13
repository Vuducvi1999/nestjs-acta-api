import Mux from '@mux/mux-node';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  ActivityType,
  Role,
  NotificationAction,
  RelatedModel,
} from '@prisma/client';
import { Cache } from 'cache-manager';
import { Server } from 'socket.io';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { NotificationService } from '../notifications/notification.service';
import { AllConfigType } from '../common/configs/types/index.type';
import { PrismaService } from '../common/services/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import {
  PaginatedPostResponseDto,
  PostResponseDto,
  PostFeelingResponseDto,
  PostActivityCategoryResponseDto,
  PostActivityResponseDto,
} from './dto/post-response.dto';
import { POST_CONSTANTS, WEBSOCKET_EVENTS } from './posts.constants';
import { PostHelpers } from './posts.helpers';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostAnalyticsDto } from './dto/post-response.dto';
import { GoongApiResponse } from './interfaces/post-location.interface';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);
  private readonly video: Mux.Video;

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly httpService: HttpService,
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

  async getPlaceSuggestions(query: string): Promise<GoongApiResponse> {
    try {
      if (!query || query.trim().length === 0) {
        return {
          status: 'OK',
          predictions: [],
        };
      }

      const apiKey = process.env.GOONG_API_KEY;
      if (!apiKey) {
        this.logger.error('GOONG_API_KEY is not configured');
        throw new BadRequestException(
          'Place suggestions service is not configured',
        );
      }

      const encodedQuery = encodeURIComponent(query.trim());
      const url = `https://rsapi.goong.io/Place/AutoComplete?api_key=${apiKey}&input=${encodedQuery}`;

      this.logger.log(`Fetching place suggestions for query: ${query}`);

      const response = await this.httpService.axiosRef.get(url, {
        timeout: 10000, // 10 seconds timeout
      });

      if (response.status !== 200) {
        this.logger.error(`Goong API error: ${response.status}`);
        throw new BadRequestException('Failed to fetch place suggestions');
      }

      const data: GoongApiResponse = response.data;

      if (data.status !== 'OK') {
        const errorMessage = data.error_message || 'Unknown error';
        this.logger.error(
          `Goong API returned error status: ${data.status} - ${errorMessage}`,
        );

        if (data.status === 'REQUEST_DENIED' && errorMessage.includes('key')) {
          throw new BadRequestException(
            'Place suggestions service configuration error',
          );
        }

        throw new BadRequestException(
          `Place suggestions service error: ${errorMessage}`,
        );
      }

      this.logger.log(
        `Found ${data.predictions?.length || 0} place suggestions for query: ${query}`,
      );

      return data;
    } catch (error) {
      if (error.response) {
        // Axios error with response
        this.logger.error(
          `Goong API error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`,
        );
      } else if (error.request) {
        // Axios error without response (network error)
        this.logger.error('Network error when calling Goong API');
      } else {
        // Other error
        this.logger.error(
          `Error fetching place suggestions: ${error.message}`,
          error.stack,
        );
      }
      throw new BadRequestException('Failed to fetch place suggestions');
    }
  }

  async getLikedPosts(
    userId: string,
    query: PostQueryDto = {},
  ): Promise<PaginatedPostResponseDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      // Get total count first
      const total = await this.prisma.post.count({
        where: {
          deletedAt: null,
          isPublished: true,
          user: {
            deletedAt: null, // Only count posts from non-deleted users
          },
          reactions: {
            some: {
              userId: userId,
            },
          },
        },
      });

      // If no results found, return empty array
      if (total === 0) {
        return PaginatedPostResponseDto.fromPaginatedPosts({
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      // Get posts that the user has liked
      const likedPosts = await this.prisma.post.findMany({
        where: {
          deletedAt: null,
          isPublished: true,
          user: {
            deletedAt: null, // Only include posts from non-deleted users
          },
          reactions: {
            some: {
              userId: userId,
            },
          },
        },
        include: PostHelpers.getPostIncludeClause(),
        orderBy: PostHelpers.buildPostsOrderBy(query.mode),
        skip,
        take: limit,
      });

      // Transform to response DTOs
      const data = likedPosts.map((post) =>
        PostResponseDto.fromPost(post, userId, false),
      );

      return PaginatedPostResponseDto.fromPaginatedPosts({
        data,
        total,
        page,
        limit,
      });
    } catch (error) {
      PostHelpers.handleError(error, 'getLikedPosts', this.logger);
    }
  }

  async getSavedPosts(
    userId: string,
    query: PostQueryDto = {},
  ): Promise<PaginatedPostResponseDto> {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    try {
      const total = await this.prisma.savedPost.count({
        where: { userId },
      });

      if (total === 0) {
        return PaginatedPostResponseDto.fromPaginatedPosts({
          data: [],
          total: 0,
          page,
          limit,
        });
      }

      const saved = await this.prisma.savedPost.findMany({
        where: { userId },
        select: { postId: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      const postIds = saved.map((s) => s.postId);

      const posts = await this.prisma.post.findMany({
        where: {
          id: { in: postIds },
          deletedAt: null,
          user: { deletedAt: null },
        },
        include: PostHelpers.getPostIncludeClause(),
      });

      const data = posts.map((post) =>
        PostResponseDto.fromPost(post, userId, false),
      );

      return PaginatedPostResponseDto.fromPaginatedPosts({
        data,
        total,
        page,
        limit,
      });
    } catch (error) {
      PostHelpers.handleError(error, 'getSavedPosts', this.logger);
    }
  }

  async savePost(
    postId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    // Ensure post exists and is not deleted
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) {
      throw new NotFoundException('Post not found');
    }

    await this.prisma.savedPost.upsert({
      where: { userId_postId: { userId, postId } },
      create: { userId, postId },
      update: {},
    });

    return { success: true };
  }

  async unsavePost(
    postId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.savedPost.deleteMany({ where: { userId, postId } });
    return { success: true };
  }

  async findAll(
    query: PostQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedPostResponseDto> {
    try {
      const cacheKey = PostHelpers.generatePostsCacheKey(query);
      const cachedData =
        await this.cacheManager.get<PaginatedPostResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query.page || POST_CONSTANTS.DEFAULT_PAGE;
      const limit = query.limit || POST_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const where = PostHelpers.buildPostsWhereClause(query);
      const orderBy = PostHelpers.buildPostsOrderBy(query.mode);

      const prismaQuery = {
        where,
        orderBy,
        skip,
        take: limit,
        include: PostHelpers.getPostIncludeClause(),
      };

      const total = await this.prisma.post.count({ where });
      const posts = await this.prisma.post.findMany(prismaQuery);

      // Filter out deleted users
      const filteredPosts = posts.filter((post) => !post.user.deletedAt);

      const paginatedResponse = PaginatedPostResponseDto.fromPaginatedPosts({
        data: filteredPosts.map((post) =>
          PostResponseDto.fromPost(post, currentUserId),
        ),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });

      // Cache the paginated response
      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'findAll method', this.logger);
    }
  }

  async findOne(
    id: string,
    currentUserId?: string,
    includeAnalytics: boolean = false,
  ): Promise<PostResponseDto | null> {
    try {
      const cacheKey = PostHelpers.generatePostCacheKey(id);
      const cachedPost = await this.cacheManager.get<PostResponseDto>(cacheKey);
      if (cachedPost && !includeAnalytics) return cachedPost;

      const post = await this.prisma.post.findUnique({
        where: { id },
        include: PostHelpers.getPostIncludeClause(),
      });

      if (!post) {
        this.logger.warn(`Post with id ${id} not found`);
        return null;
      }

      // Filter out deleted users
      if (post.user.deletedAt) {
        this.logger.warn(`Post with id ${id} has a deleted user`);
        return null;
      }

      const postResponse = PostResponseDto.fromPost(
        post,
        currentUserId,
        includeAnalytics,
      );

      // Cache the post response only if analytics are not included
      if (!includeAnalytics) {
        await this.cacheManager.set(
          cacheKey,
          postResponse,
          POST_CONSTANTS.CACHE_TTL,
        );
      }

      return postResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'findOne method', this.logger);
    }
  }

  async findPostAnalytics(
    id: string,
    currentUserId?: string,
  ): Promise<PostAnalyticsDto | null> {
    try {
      const cacheKey = `${PostHelpers.generatePostCacheKey(id)}:analytics`;
      const cachedAnalytics =
        await this.cacheManager.get<PostAnalyticsDto>(cacheKey);
      if (cachedAnalytics) return cachedAnalytics;

      const post = await this.prisma.post.findUnique({
        where: { id },
        include: PostHelpers.getPostIncludeClause(),
      });

      if (!post) {
        this.logger.warn(`Post with id ${id} not found`);
        return null;
      }

      // Filter out deleted users
      if (post.user.deletedAt) {
        this.logger.warn(`Post with id ${id} has a deleted user`);
        return null;
      }

      const analytics = PostAnalyticsDto.fromPostData(post);

      // Cache the analytics with a shorter TTL since analytics data changes frequently
      await this.cacheManager.set(
        cacheKey,
        analytics,
        POST_CONSTANTS.CACHE_TTL / 2, // Half the regular cache time
      );

      return analytics;
    } catch (error) {
      PostHelpers.handleError(error, 'findPostAnalytics method', this.logger);
    }
  }

  async createPost(
    dto: CreatePostDto,
    userId: string,
    server?: Server,
  ): Promise<PostResponseDto> {
    try {
      // Enforce mutual exclusivity between feeling and activity
      if (dto.feelingId && dto.activityId) {
        throw new BadRequestException(
          'You can only select either a feeling or an activity, not both.',
        );
      }
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validatePostContent(
        dto.content,
        dto.imageUrls,
        dto.videoUrls,
      );

      // Validate tagged users exist
      await PostHelpers.validateTaggedUsers(this.prisma, dto.taggedUserIds);

      const newPost = await this.prisma.post.create({
        data: {
          content: dto.content,
          imageUrls: dto.imageUrls || [],
          videoUrls: dto.videoUrls || [],
          location: dto.location
            ? {
                create: {
                  address: dto.location.address,
                },
              }
            : undefined,
          user: {
            connect: { id: user.id },
          },
          taggedUsers:
            dto.taggedUserIds && dto.taggedUserIds.length > 0
              ? {
                  connect: dto.taggedUserIds.map((id) => ({ id })),
                }
              : undefined,
          publishedAt: user.role === Role.admin ? new Date() : null,
          isPublished: user.role === Role.admin ? true : false,
          feeling: dto.feelingId
            ? { connect: { id: dto.feelingId } }
            : undefined,
          activity: dto.activityId
            ? { connect: { id: dto.activityId } }
            : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
          taggedUsers: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
          location: true,
          feeling: true,
          activity: {
            include: {
              category: true,
            },
          },
        },
      });

      // Handle videos upload
      if (dto.videoUrls && dto.videoUrls.length > 0) {
        try {
          await Promise.all(
            dto.videoUrls.map(async (videoUrl) => {
              const asset = await this.video.assets.create({
                inputs: [{ url: videoUrl, type: 'video' }],
                playback_policy: ['public'],
                test: false,
                passthrough: `post:${newPost.id}`,
              });

              // Save Mux data to the database
              await this.prisma.muxData.create({
                data: {
                  assetId: asset.id,
                  playbackId: asset.playback_ids?.[0]?.id,
                  postId: newPost.id,
                },
              });
            }),
          );
        } catch (error) {
          this.logger.error(
            `Error uploading video to Mux: ${error.message}`,
            error.stack,
          );
          throw new BadRequestException('Failed to upload video');
        }
      }

      // Log the activity
      await this.activityLogService.createActivityLog(
        newPost.id,
        'POST',
        ActivityType.POST_CREATED,
        user,
        `User ${user.referenceId} created a new post`,
        {
          newPost: {
            id: newPost.id,
            content: newPost.content,
            imageUrls: newPost.imageUrls,
            videoUrls: newPost.videoUrls,
          },
        },
      );

      const postResponse = PostResponseDto.fromPost(newPost, userId);
      // Cache the new post for quick access
      await this.cacheManager.set(
        PostHelpers.generatePostCacheKey(newPost.id),
        postResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      // Broadcast to all connected clients if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.NEW_POST, postResponse);
      }

      this.logger.log(`Post created successfully: ${newPost.id}`);

      return postResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'create post', this.logger);
    }
  }

  async updatePost(
    postId: string,
    dto: UpdatePostDto,
    userId: string,
    server?: Server,
  ): Promise<PostResponseDto> {
    try {
      // Enforce mutual exclusivity between feeling and activity on update
      let feelingField: any = undefined;
      let activityField: any = undefined;
      if (dto.activityId) {
        activityField = { connect: { id: dto.activityId } };
        feelingField = { disconnect: true };
      } else if (dto.feelingId) {
        feelingField = { connect: { id: dto.feelingId } };
        activityField = { disconnect: true };
      }
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validatePostContent(
        dto.content,
        dto.imageUrls,
        dto.videoUrls,
      );

      // Validate tagged users exist if provided
      if (dto.taggedUserIds) {
        await PostHelpers.validateTaggedUsers(this.prisma, dto.taggedUserIds);
      }

      const isAdmin = user.role === Role.admin;

      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId, deletedAt: null },
        include: {
          location: true,
          taggedUsers: {
            select: {
              id: true,
            },
          },
        },
      });
      if (!existingPost) {
        throw new NotFoundException('Post not found');
      }

      // User have 15 minutes to update the post after created
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

      if (existingPost.createdAt < fifteenMinutesAgo && !isAdmin) {
        throw new BadRequestException(
          'You are not allowed to update this post after 15 minutes',
        );
      }

      if (existingPost.userId !== user.id && !isAdmin) {
        throw new BadRequestException(
          'You are not allowed to update this post',
        );
      }

      // Delete location if it's not provided
      if (!dto.location && existingPost.location) {
        await this.prisma.postLocation.delete({
          where: { id: existingPost.location.id },
        });
      }

      // Update post
      const post = await this.prisma.post.update({
        where: { id: postId },
        data: {
          content: dto.content,
          imageUrls: dto.imageUrls || [],
          videoUrls: dto.videoUrls || [],
          location: dto.location
            ? {
                upsert: {
                  create: {
                    address: dto.location.address,
                  },
                  update: {
                    address: dto.location.address,
                  },
                },
              }
            : undefined,
          taggedUsers:
            dto.taggedUserIds !== undefined
              ? {
                  set:
                    dto.taggedUserIds.length > 0
                      ? dto.taggedUserIds.map((id) => ({ id }))
                      : [],
                }
              : undefined,
          feeling: feelingField,
          activity: activityField,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
          taggedUsers: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
          location: true,
          feeling: true,
          activity: {
            include: {
              category: true,
            },
          },
        },
      });

      const postResponse = PostResponseDto.fromPost(post, userId);

      // Cache the updated post
      await this.cacheManager.set(
        PostHelpers.generatePostCacheKey(post.id),
        postResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      // Broadcast to all connected clients if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.POST_UPDATED, postResponse);
      }

      this.logger.log(`Post updated successfully: ${post.id}`);

      return postResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'update post', this.logger);
    }
  }

  async publishPost(
    postId: string,
    userId: string,
    server?: Server,
  ): Promise<PostResponseDto> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validateAdminPermission(user);

      const post = await this.prisma.post.update({
        where: { id: postId },
        data: { isPublished: true, publishedAt: new Date() },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
        },
      });

      // Create notification for post owner
      this.logger.log(
        `Creating notification for post owner ${post.user.id} when admin ${userId} approved post ${postId}`,
      );

      await this.notificationService.createNotification({
        userId: post.user.id,
        relatedModel: RelatedModel.post,
        relatedModelId: postId,
        action: NotificationAction.approved,
        message: `Bài viết của bạn đã được phê duyệt và xuất bản`,
        linkUrl: `/posts/${postId}`,
      });

      this.logger.log(`Notification created successfully for post ${postId}`);

      // Log the activity
      await this.activityLogService.createActivityLog(
        post.id,
        'POST',
        ActivityType.POST_PUBLISHED,
        user,
        `User ${user.referenceId} published a post`,
        { postId: post.id },
      );

      const postResponse = PostResponseDto.fromPost(post, userId);

      // Cache the updated post
      await this.cacheManager.set(
        PostHelpers.generatePostCacheKey(post.id),
        postResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      // Broadcast to all connected clients if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.POST_PUBLISHED, postResponse);

        // Emit notification event to post owner
        this.logger.log(
          `Emitting POST_APPROVED event to post owner ${post.user.id}`,
        );
        this.logger.log(`Event data:`, {
          postId,
          adminName: user.fullName,
          message: `Bài viết của bạn đã được phê duyệt và xuất bản`,
        });
        server.to(post.user.id).emit(WEBSOCKET_EVENTS.POST_APPROVED, {
          postId,
          adminName: user.fullName,
          message: `Bài viết của bạn đã được phê duyệt và xuất bản`,
        });
        this.logger.log(`POST_APPROVED event emitted successfully`);
      }

      this.logger.log(`Post published successfully: ${post.id}`);

      return postResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'publish post', this.logger);
    }
  }

  async unpublishPost(
    postId: string,
    userId: string,
    server?: Server,
  ): Promise<PostResponseDto> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validateAdminPermission(user);

      const post = await this.prisma.post.update({
        where: { id: postId },
        data: { isPublished: false },
        include: {
          user: {
            select: {
              id: true,
              status: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
        },
      });

      // Log the activity
      await this.activityLogService.createActivityLog(
        post.id,
        'POST',
        ActivityType.POST_UNPUBLISHED,
        user,
        `User ${user.referenceId} unpublished a post`,
        { postId: post.id },
      );

      const postResponse = PostResponseDto.fromPost(post, userId);

      // Cache the updated post
      await this.cacheManager.set(
        PostHelpers.generatePostCacheKey(post.id),
        postResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      // Broadcast to all connected clients if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.POST_UNPUBLISHED, postResponse);
      }

      this.logger.log(`Post unpublished successfully: ${post.id}`);

      return postResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'unpublish post', this.logger);
    }
  }

  async rejectPost(
    postId: string,
    userId: string,
    server?: Server,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validateAdminPermission(user);

      const post = await this.prisma.post.update({
        where: { id: postId },
        data: { deletedAt: new Date(), publishedAt: null },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
        },
      });

      if (post.videoUrls && post.videoUrls.length > 0) {
        // Delete video assets from Mux
        const muxData = await this.prisma.muxData.findMany({
          where: { postId: post.id },
        });

        if (muxData.length > 0) {
          await Promise.all(
            muxData.map((data) =>
              this.video.assets.delete(data.assetId).catch((error) => {
                this.logger.error(
                  `Failed to delete video asset ${data.assetId}: ${error.message}`,
                );
              }),
            ),
          );

          // Delete Mux data from the database
          await this.prisma.muxData.deleteMany({
            where: { postId: post.id },
          });
        }
      }

      // Log the activity
      await this.activityLogService.createActivityLog(
        post.id,
        'POST',
        ActivityType.POST_REJECTED,
        user,
        `User ${user.referenceId} rejected a post`,
        { postId: post.id },
      );

      const postResponse = PostResponseDto.fromPost(post, userId);

      // Cache the updated post
      await this.cacheManager.set(
        PostHelpers.generatePostCacheKey(post.id),
        postResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      // Broadcast to all connected clients if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.POST_REJECTED, postResponse);
      }

      this.logger.log(`Post rejected successfully: ${post.id}`);

      return { success: true, message: 'Post rejected successfully' };
    } catch (error) {
      PostHelpers.handleError(error, 'reject post', this.logger);
    }
  }

  async deletePost(
    postId: string,
    userId: string,
    server?: Server,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);

      // First get the post to check ownership
      const existingPost = await this.prisma.post.findUnique({
        where: { id: postId, deletedAt: null },
      });

      if (!existingPost) {
        throw new NotFoundException('Post not found');
      }

      // Check permissions - user can delete their own post or admin can delete any post
      if (existingPost.userId !== user.id && user.role !== Role.admin) {
        throw new BadRequestException('You can only delete your own posts.');
      }

      const post = await this.prisma.post.delete({
        where: { id: postId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              status: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
              verificationDate: true,
              role: true,
            },
          },
        },
      });

      if (post.videoUrls && post.videoUrls.length > 0) {
        // Delete video assets from Mux
        const muxData = await this.prisma.muxData.findMany({
          where: { postId: post.id },
        });

        if (muxData.length > 0) {
          await Promise.all(
            muxData.map((data) =>
              this.video.assets.delete(data.assetId).catch((error) => {
                this.logger.error(
                  `Failed to delete video asset ${data.assetId}: ${error.message}`,
                );
              }),
            ),
          );

          // Delete Mux data from the database
          await this.prisma.muxData.deleteMany({
            where: { postId: post.id },
          });
        }
      }

      // Log the activity
      await this.activityLogService.createActivityLog(
        post.id,
        'POST',
        ActivityType.POST_DELETED,
        user,
        `User ${user.referenceId} deleted a post`,
        { postId: post.id },
      );

      const postResponse = PostResponseDto.fromPost(post, userId);

      // Cache the updated post
      await this.cacheManager.set(
        PostHelpers.generatePostCacheKey(post.id),
        postResponse,
        POST_CONSTANTS.CACHE_TTL,
      );

      // Broadcast to all connected clients if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.POST_DELETED, postResponse);
      }

      this.logger.log(`Post deleted successfully: ${post.id}`);

      return { success: true, message: 'Post deleted successfully' };
    } catch (error) {
      PostHelpers.handleError(error, 'delete post', this.logger);
    }
  }

  // --- New methods for feelings and activities ---
  async getAllFeelings(): Promise<PostFeelingResponseDto[]> {
    const feelings = await this.prisma.postFeeling.findMany({
      orderBy: { label: 'asc' },
    });
    return feelings.map(PostFeelingResponseDto.fromModel);
  }

  async getAllActivityCategories(): Promise<PostActivityCategoryResponseDto[]> {
    const categories = await this.prisma.postActivityCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map(PostActivityCategoryResponseDto.fromModel);
  }

  async getActivitiesByCategoryId(
    categoryId: string,
  ): Promise<PostActivityResponseDto[]> {
    const activities = await this.prisma.postActivity.findMany({
      where: { categoryId },
      orderBy: { label: 'asc' },
    });
    return activities.map(PostActivityResponseDto.fromModel);
  }
}
