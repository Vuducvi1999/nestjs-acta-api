import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PostService } from '../../posts/posts.service';
import { SocketEmitterService } from './socket-emitter.service';
import {
  AVATAR_POST_CONSTANTS,
  AVATAR_POST_MESSAGES,
  AVATAR_POST_CONFIG,
  AvatarPostType,
  AvatarUpdateReason,
} from '../constants/avatar-post.constants';
import { USER_CONFIG_KEYS } from '../models/user-config.constant';
import {
  AvatarUpdateContext,
  AvatarPostCreationOptions,
  AvatarPostCreationResult,
  AvatarPostTemplateData,
  CreateAvatarPostRequest,
  UserAvatarPostPreferences,
  AvatarPostStats,
} from '../types/avatar-post.types';
import { CreatePostDto } from '../../posts/dto/create-post.dto';

@Injectable()
export class AvatarPostService {
  private readonly logger = new Logger(AvatarPostService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postService: PostService,
    private readonly socketEmitterService: SocketEmitterService,
  ) {}

  /**
   * Main method to create an avatar update post
   */
  async createAvatarPost(
    request: CreateAvatarPostRequest,
  ): Promise<AvatarPostCreationResult> {
    try {
      this.logger.log(
        `Creating avatar post for user ${request.context.userId}`,
      );

      // Check if avatar posts are enabled globally
      if (!AVATAR_POST_CONSTANTS.ENABLED) {
        return {
          success: false,
          skipped: true,
          skipReason: 'Avatar posts are disabled globally',
        };
      }

      // Get user information
      const user = await this.getUserWithPreferences(request.context.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Check user preferences
      const userPreferences = this.getUserPreferences(
        user,
        request.preferences,
      );
      if (!userPreferences.enabled) {
        return {
          success: false,
          skipped: true,
          skipReason: 'User has disabled avatar posts',
        };
      }

      // Check rate limiting
      // const rateLimitCheck = await this.checkRateLimit(request.context.userId);
      // if (!rateLimitCheck.allowed) {
      //   return {
      //     success: false,
      //     skipped: true,
      //     skipReason: rateLimitCheck.reason,
      //   };
      // }

      // Generate post content
      const postContent = await this.generatePostContent(
        request.context,
        userPreferences,
        user,
      );

      // Create the post
      const postData = this.buildPostData(
        postContent,
        request.context,
        userPreferences,
        request.options,
      );

      const post = await this.postService.createPost(postData, user.id);
      this.socketEmitterService.emitNewPost(post);

      this.logger.log(
        `Successfully created avatar post ${post.id} for user ${request.context.userId}`,
      );

      return {
        success: true,
        postId: post.id,
        message: 'Avatar post created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error creating avatar post for user ${request.context.userId}:`,
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get user with avatar post preferences
   */
  private async getUserWithPreferences(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        avatar: true,
        userConfig: true,
      },
    });
  }

  /**
   * Get user preferences for avatar posts
   */
  private getUserPreferences(
    user: any,
    overrides?: Partial<UserAvatarPostPreferences>,
  ): UserAvatarPostPreferences {
    const config = user.userConfig?.config || {};
    const avatarPostConfig = config[USER_CONFIG_KEYS.AVATAR_POSTS] || {};

    return {
      enabled: avatarPostConfig.enabled ?? true,
      postType: avatarPostConfig.postType ?? AvatarPostType.SIMPLE,
      autoPublish:
        avatarPostConfig.autoPublish ??
        AVATAR_POST_CONFIG.AUTO_PUBLISH_ROLES.includes(user.role),
      includeComparison: avatarPostConfig.includeComparison ?? false,
      customMessage: avatarPostConfig.customMessage,
      notifyFollowers: avatarPostConfig.notifyFollowers ?? true,
      ...overrides,
    };
  }

  /**
   * Check rate limiting for avatar posts
   */
  private async checkRateLimit(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(
      now.getTime() - AVATAR_POST_CONFIG.MIN_UPDATE_INTERVAL * 60 * 1000,
    );

    // Check daily limit
    const postsToday = await this.prisma.post.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
        content: {
          contains: 'ảnh đại diện', // Vietnamese for "avatar"
        },
      },
    });

    if (postsToday >= AVATAR_POST_CONFIG.MAX_POSTS_PER_DAY) {
      return {
        allowed: false,
        reason: 'Daily avatar post limit reached',
      };
    }

    // Check minimum interval
    const recentAvatarUpdate = await this.prisma.post.findFirst({
      where: {
        userId,
        createdAt: { gte: thirtyMinutesAgo },
        content: {
          contains: 'ảnh đại diện',
        },
      },
    });

    if (recentAvatarUpdate) {
      return {
        allowed: false,
        reason: 'Too frequent avatar updates',
      };
    }

    return { allowed: true };
  }

  /**
   * Generate post content based on context and preferences
   */
  private async generatePostContent(
    context: AvatarUpdateContext,
    preferences: UserAvatarPostPreferences,
    user: any,
  ): Promise<string> {
    // Use custom message if provided
    if (preferences.customMessage) {
      return preferences.customMessage;
    }

    // Generate template data
    const templateData: AvatarPostTemplateData = {
      userName: user.fullName,
      timeOfDay: this.getTimeOfDay(),
      season: this.getCurrentSeason(),
      isFirstAvatar: !context.oldAvatarUrl,
      daysSinceLastUpdate: await this.getDaysSinceLastAvatarUpdate(user.id),
    };

    // Generate content based on post type
    switch (preferences.postType) {
      case AvatarPostType.TIME_BASED:
        return this.getTimeBasedMessage(templateData.timeOfDay);
      case AvatarPostType.SEASONAL:
        return this.getSeasonalMessage(templateData.season);
      case AvatarPostType.CELEBRATION:
        return this.getCelebrationMessage(templateData);
      case AvatarPostType.WITH_COMPARISON:
        return this.getComparisonMessage(context, templateData);
      default:
        return this.getRandomMessage();
    }
  }

  /**
   * Get time-based message
   */
  private getTimeBasedMessage(timeOfDay: string): string {
    const messages = AVATAR_POST_MESSAGES.TIME_BASED;
    switch (timeOfDay) {
      case 'morning':
        return messages.MORNING;
      case 'afternoon':
        return messages.AFTERNOON;
      case 'evening':
        return messages.EVENING;
      case 'night':
        return messages.NIGHT;
      default:
        return AVATAR_POST_MESSAGES.DEFAULT;
    }
  }

  /**
   * Get seasonal message
   */
  private getSeasonalMessage(season: string): string {
    const messages = AVATAR_POST_MESSAGES.SEASONAL;
    switch (season) {
      case 'spring':
        return messages.SPRING;
      case 'summer':
        return messages.SUMMER;
      case 'autumn':
        return messages.AUTUMN;
      case 'winter':
        return messages.WINTER;
      default:
        return AVATAR_POST_MESSAGES.DEFAULT;
    }
  }

  /**
   * Get celebration message
   */
  private getCelebrationMessage(templateData: AvatarPostTemplateData): string {
    if (templateData.isFirstAvatar) {
      return 'Ảnh đại diện đầu tiên của tôi trên ACTA! 🎉✨';
    }
    return this.getRandomMessage();
  }

  /**
   * Get comparison message
   */
  private getComparisonMessage(
    context: AvatarUpdateContext,
    templateData: AvatarPostTemplateData,
  ): string {
    if (context.oldAvatarUrl) {
      return 'Ảnh cũ vs ảnh mới! Các bạn thích ảnh nào hơn? 🤔✨';
    }
    return this.getCelebrationMessage(templateData);
  }

  /**
   * Get random message from available options
   */
  private getRandomMessage(): string {
    const messages = AVATAR_POST_MESSAGES.WITH_EMOJI;
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
  }

  /**
   * Get current time of day
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Get current season
   */
  private getCurrentSeason(): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  /**
   * Get days since last avatar update
   */
  private async getDaysSinceLastAvatarUpdate(userId: string): Promise<number> {
    const lastUpdate = await this.prisma.post.findFirst({
      where: {
        userId,
        content: {
          contains: 'ảnh đại diện',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!lastUpdate) return 0;

    const daysDiff = Math.floor(
      (Date.now() - lastUpdate.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysDiff;
  }

  /**
   * Build post data for creation
   */
  private buildPostData(
    content: string,
    context: AvatarUpdateContext,
    preferences: UserAvatarPostPreferences,
    options?: Partial<AvatarPostCreationOptions>,
  ): CreatePostDto {
    const imageUrls = [context.newAvatarUrl];

    // Add comparison if enabled and old avatar exists
    if (
      preferences.includeComparison &&
      context.oldAvatarUrl &&
      options?.includeComparison !== false
    ) {
      imageUrls.unshift(context.oldAvatarUrl);
    }

    return {
      content,
      imageUrls,
      taggedUserIds: options?.taggedUserIds,
      location: options?.location
        ? {
            address: options.location.address || '',
          }
        : undefined,
      _atLeastOneFieldCheck: true,
    };
  }

  /**
   * Get avatar post statistics
   */
  async getAvatarPostStats(userId?: string): Promise<AvatarPostStats> {
    const whereClause = userId
      ? {
          userId,
          content: { contains: 'ảnh đại diện' },
        }
      : {
          content: { contains: 'ảnh đại diện' },
        };

    const totalPosts = await this.prisma.post.count({
      where: whereClause,
    });

    // For now, return basic stats
    // In a real implementation, you'd track more detailed statistics
    return {
      totalAvatarUpdates: totalPosts,
      postsCreated: totalPosts,
      postsSkipped: 0,
      successRate: '100%',
      skipReasons: {
        tooFrequent: 0,
        dailyLimitReached: 0,
        userPreference: 0,
        error: 0,
      },
    };
  }

  /**
   * Update user avatar post preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserAvatarPostPreferences>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userConfig: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentConfig = user.userConfig?.config || {};
    const currentAvatarPosts =
      (currentConfig[USER_CONFIG_KEYS.AVATAR_POSTS] as Record<string, any>) ||
      {};
    const updatedConfig = {
      ...(currentConfig as Record<string, any>),
      [USER_CONFIG_KEYS.AVATAR_POSTS]: {
        ...currentAvatarPosts,
        ...preferences,
      },
    };

    if (user.userConfig) {
      await this.prisma.userConfig.update({
        where: { id: user.userConfig.id },
        data: { config: updatedConfig },
      });
    } else {
      await this.prisma.userConfig.create({
        data: {
          userId,
          config: updatedConfig,
        },
      });
    }
  }
}
