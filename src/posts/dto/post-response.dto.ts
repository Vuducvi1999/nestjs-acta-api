import { ReactionType, Role, UserStatus } from '@prisma/client';

export class PostUserResponseDto {
  id: string;

  fullName: string;
  avatarUrl?: string;
  status: UserStatus;
  referenceId: string;
  verificationDate?: Date | null;
  role: Role;
}

export class PostReactionResponseDto {
  id: string;

  postId: string;

  type: ReactionType;
  user: PostUserResponseDto;
}

export class PostCommentResponseDto {
  id: string;

  content: string;
  user: PostUserResponseDto;
  likeCount: number;
  isLikedByCurrentUser?: boolean;

  createdAt: Date;
  updatedAt: Date;
  parentId?: string | null;

  replies?: PostCommentResponseDto[];
}

export class PostMuxDataResponseDto {
  id: string;

  assetId: string;
  playbackId?: string;

  constructor(partial: Partial<PostMuxDataResponseDto>) {
    Object.assign(this, partial);
  }

  static fromMuxData(muxData: any): PostMuxDataResponseDto {
    return {
      id: muxData.id,
      assetId: muxData.assetId,
      playbackId: muxData.playbackId,
    };
  }
}

export class PostAnalyticsDto {
  interactions: number;
  engagementRate: number;
  contentMetrics: {
    hasImages: boolean;
    hasVideos: boolean;
    contentLength: number;
    averageCommentLength: number;
  };
  demographics: {
    ageGroups: { range: string; count: number; percentage: number }[];
    genders: { type: string; count: number; percentage: number }[];
    countries: { country: string; count: number; percentage: number }[];
    userRoles: { role: string; count: number; percentage: number }[];
    verificationStatus: { verified: number; unverified: number };
  };
  reactionBreakdown: {
    type: string;
    count: number;
    percentage: number;
  }[];
  timeAnalytics: {
    daysSinceCreated: number;
    daysSincePublished: number;
    peakEngagementHour: number;
    isRecentlyCreated: boolean;
  };
  performanceMetrics: {
    engagementVelocity: number; // interactions per day
    commentToReactionRatio: number;
    averageResponseTime: number; // hours
  };

  constructor(partial: Partial<PostAnalyticsDto>) {
    Object.assign(this, partial);
  }

  static fromPostData(post: any): PostAnalyticsDto {
    const totalInteractions =
      post.reactionCount + post.commentCount + (post.shareCount || 0);
    const now = new Date();
    const createdAt = new Date(post.createdAt);
    const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;

    const daysSinceCreated = Math.ceil(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysSincePublished = publishedAt
      ? Math.ceil(
          (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0;

    // Calculate engagement rate (interactions per day since published or created)
    const effectiveDays = Math.max(daysSincePublished || daysSinceCreated, 1);
    const engagementRate = totalInteractions / effectiveDays;

    // Process demographics from reactions and comments
    const allUsers = [
      ...(post.reactions?.map((r: any) => r.user) || []),
      ...(post.comments?.map((c: any) => c.user) || []),
      ...(post.comments?.flatMap(
        (c: any) => c.replies?.map((r: any) => r.user) || [],
      ) || []),
    ];

    // Remove duplicates by user ID
    const uniqueUsers = allUsers.filter(
      (user, index, self) => index === self.findIndex((u) => u.id === user.id),
    );

    const totalUniqueUsers = uniqueUsers.length;

    // Age groups based on verification date (proxy for account age)
    const ageGroups = PostAnalyticsDto.calculateAgeGroups(uniqueUsers);

    // Gender distribution
    const genders = PostAnalyticsDto.calculateGenderDistribution(uniqueUsers);

    // Country distribution
    const countries =
      PostAnalyticsDto.calculateCountryDistribution(uniqueUsers);

    // User roles distribution
    const userRoles =
      PostAnalyticsDto.calculateUserRolesDistribution(uniqueUsers);

    // Verification status
    const verificationStatus =
      PostAnalyticsDto.calculateVerificationStatus(uniqueUsers);

    // Reaction breakdown
    const reactionBreakdown = PostAnalyticsDto.calculateReactionBreakdown(
      post.reactions || [],
    );

    // Content metrics
    const contentMetrics = {
      hasImages: (post.imageUrls || []).length > 0,
      hasVideos: (post.videoUrls || []).length > 0,
      contentLength: post.content?.length || 0,
      averageCommentLength: PostAnalyticsDto.calculateAverageCommentLength(
        post.comments || [],
      ),
    };

    // Performance metrics
    const performanceMetrics = {
      engagementVelocity: totalInteractions / effectiveDays,
      commentToReactionRatio:
        post.reactionCount > 0 ? post.commentCount / post.reactionCount : 0,
      averageResponseTime: PostAnalyticsDto.calculateAverageResponseTime(
        post.comments || [],
        createdAt,
      ),
    };

    // Time analytics
    const timeAnalytics = {
      daysSinceCreated,
      daysSincePublished,
      peakEngagementHour: PostAnalyticsDto.calculatePeakEngagementHour(
        post.reactions || [],
        post.comments || [],
      ),
      isRecentlyCreated: daysSinceCreated <= 7,
    };

    return new PostAnalyticsDto({
      interactions: totalInteractions,
      engagementRate,
      contentMetrics,
      demographics: {
        ageGroups,
        genders,
        countries,
        userRoles,
        verificationStatus,
      },
      reactionBreakdown,
      timeAnalytics,
      performanceMetrics,
    });
  }

  private static calculateAgeGroups(
    users: any[],
  ): { range: string; count: number; percentage: number }[] {
    const groups = {
      'Người dùng mới (0-30 ngày)': 0,
      'Người dùng thường xuyên (31-90 ngày)': 0,
      'Người dùng lâu năm (91-365 ngày)': 0,
      'Người dùng kỳ cựu (1+ năm)': 0,
    };

    const now = new Date();
    users.forEach((user) => {
      if (user.verificationDate) {
        const daysSinceVerification = Math.ceil(
          (now.getTime() - new Date(user.verificationDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        if (daysSinceVerification <= 30) {
          groups['Người dùng mới (0-30 ngày)']++;
        } else if (daysSinceVerification <= 90) {
          groups['Người dùng thường xuyên (31-90 ngày)']++;
        } else if (daysSinceVerification <= 365) {
          groups['Người dùng lâu năm (91-365 ngày)']++;
        } else {
          groups['Người dùng kỳ cựu (1+ năm)']++;
        }
      }
    });

    const total = users.length;
    return Object.entries(groups).map(([range, count]) => ({
      range,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
  }

  private static calculateGenderDistribution(
    users: any[],
  ): { type: string; count: number; percentage: number }[] {
    const genders = users.reduce((acc, user) => {
      // Note: Gender field might not be available in user selection, so we'll use roles as a proxy
      const type = user.role || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const total = users.length;
    return Object.entries(genders).map(([type, count]) => ({
      type,
      count: count as number,
      percentage: total > 0 ? ((count as number) / total) * 100 : 0,
    }));
  }

  private static calculateCountryDistribution(
    users: any[],
  ): { country: string; count: number; percentage: number }[] {
    // Since country might not be available in user selection, we'll use status as a proxy
    const countries = users.reduce((acc, user) => {
      const country = user.status || 'unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {});

    const total = users.length;
    return Object.entries(countries).map(([country, count]) => ({
      country,
      count: count as number,
      percentage: total > 0 ? ((count as number) / total) * 100 : 0,
    }));
  }

  private static calculateUserRolesDistribution(
    users: any[],
  ): { role: string; count: number; percentage: number }[] {
    const roles = users.reduce((acc, user) => {
      const role = user.role || 'unknown';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    const total = users.length;
    return Object.entries(roles).map(([role, count]) => ({
      role,
      count: count as number,
      percentage: total > 0 ? ((count as number) / total) * 100 : 0,
    }));
  }

  private static calculateVerificationStatus(users: any[]): {
    verified: number;
    unverified: number;
  } {
    const verified = users.filter((user) => user.verificationDate).length;
    const unverified = users.length - verified;

    return { verified, unverified };
  }

  private static calculateReactionBreakdown(
    reactions: any[],
  ): { type: string; count: number; percentage: number }[] {
    const reactionCounts = reactions.reduce((acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {});

    const total = reactions.length;
    return Object.entries(reactionCounts).map(([type, count]) => ({
      type,
      count: count as number,
      percentage: total > 0 ? ((count as number) / total) * 100 : 0,
    }));
  }

  private static calculateAverageCommentLength(comments: any[]): number {
    if (comments.length === 0) return 0;

    const totalLength = comments.reduce((sum, comment) => {
      return sum + (comment.content?.length || 0);
    }, 0);

    return totalLength / comments.length;
  }

  private static calculateAverageResponseTime(
    comments: any[],
    postCreatedAt: Date,
  ): number {
    if (comments.length === 0) return 0;

    const responseTimes = comments.map((comment) => {
      const commentTime = new Date(comment.createdAt);
      return (
        (commentTime.getTime() - postCreatedAt.getTime()) / (1000 * 60 * 60)
      ); // hours
    });

    return (
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    );
  }

  private static calculatePeakEngagementHour(
    reactions: any[],
    comments: any[],
  ): number {
    const hourCounts = new Array(24).fill(0);

    [...reactions, ...comments].forEach((item) => {
      const hour = new Date(item.createdAt).getHours();
      hourCounts[hour]++;
    });

    return hourCounts.indexOf(Math.max(...hourCounts));
  }
}

export class PostLocationResponseDto {
  address: string;

  constructor(partial: Partial<PostLocationResponseDto>) {
    Object.assign(this, partial);
  }

  static fromLocation(location: any): PostLocationResponseDto {
    return new PostLocationResponseDto({
      address: location.address,
    });
  }
}

export class PostResponseDto {
  id: string;

  content?: string | null;
  imageUrls?: string[];
  videoUrls?: string[];
  isPublished: boolean;

  reactionCount: number;
  commentCount: number;
  shareCount: number;
  isSavedByCurrentUser?: boolean;

  user: PostUserResponseDto;
  taggedUsers?: PostUserResponseDto[];

  reactions?: PostReactionResponseDto[];
  comments?: PostCommentResponseDto[];
  muxData?: PostMuxDataResponseDto[];
  analytics?: PostAnalyticsDto;
  location?: PostLocationResponseDto;

  feeling?: PostFeelingResponseDto;
  activity?: PostActivityResponseDto;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  publishedAt?: Date | null;

  constructor(partial: Partial<PostResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPost(
    post: any,
    currentUserId?: string,
    includeAnalytics: boolean = false,
  ): PostResponseDto {
    const postResponse: any = {
      id: post.id,
      content: post.content,
      imageUrls: post.imageUrls,
      videoUrls: post.videoUrls,
      isPublished: post.isPublished,
      reactionCount: post.reactionCount,
      commentCount: post.commentCount,
      shareCount: post.shareCount,
      isSavedByCurrentUser: currentUserId
        ? post.savedPosts?.some((s: any) => s.userId === currentUserId)
        : false,
      muxData: post.muxData?.map((mux: any) =>
        PostMuxDataResponseDto.fromMuxData(mux),
      ),
      location: post.location
        ? PostLocationResponseDto.fromLocation(post.location)
        : undefined,
      taggedUsers:
        post.taggedUsers?.map((taggedUser: any) => ({
          id: taggedUser.id,
          fullName: taggedUser.fullName,
          status: taggedUser.status,
          avatarUrl: taggedUser.avatar?.fileUrl,
          referenceId: taggedUser.referenceId,
          verificationDate: taggedUser.verificationDate,
          role: taggedUser.role,
        })) || [],
      user: {
        id: post.user.id,
        fullName: post.user.fullName,
        status: post.user.status,
        avatarUrl: post.user.avatar?.fileUrl,
        referenceId: post.user.referenceId,
        verificationDate: post.user.verificationDate,
        role: post.user.role,
      },
      reactions:
        post.reactions?.map((reaction: any) => ({
          id: reaction.id,
          type: reaction.type,
          user: {
            id: reaction.user.id,
            fullName: reaction.user.fullName,
            status: reaction.user.status,
            avatarUrl: reaction.user.avatar?.fileUrl,
            referenceId: reaction.user.referenceId,
            verificationDate: reaction.user.verificationDate,
            role: reaction.user.role,
          },
        })) || [],
      comments:
        post.comments?.map((comment: any) => ({
          id: comment.id,
          content: comment.content,
          likeCount: comment.likeCount || 0,
          isLikedByCurrentUser: currentUserId
            ? comment.likes?.some((like: any) => like.userId === currentUserId)
            : false,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          parentId: comment.parentId,
          user: {
            id: comment.user.id,
            fullName: comment.user.fullName,
            status: comment.user.status,
            avatarUrl: comment.user.avatar?.fileUrl,
            referenceId: comment.user.referenceId,
            verificationDate: comment.user.verificationDate,
            role: comment.user.role,
          },
          replies:
            comment.replies?.map((reply: any) => ({
              id: reply.id,
              content: reply.content,
              likeCount: reply.likeCount || 0,
              isLikedByCurrentUser: currentUserId
                ? reply.likes?.some(
                    (like: any) => like.userId === currentUserId,
                  )
                : false,
              createdAt: reply.createdAt,
              updatedAt: reply.updatedAt,
              parentId: reply.parentId,
              user: {
                id: reply.user.id,
                fullName: reply.user.fullName,
                status: reply.user.status,
                avatarUrl: reply.user.avatar?.fileUrl,
                referenceId: reply.user.referenceId,
                verificationDate: reply.user.verificationDate,
                role: reply.user.role,
              },
            })) || [],
        })) || [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      deletedAt: post.deletedAt,
      publishedAt: post.publishedAt,
      feeling: post.feeling
        ? PostFeelingResponseDto.fromModel(post.feeling)
        : undefined,
      activity: post.activity
        ? PostActivityResponseDto.fromModel({
            ...post.activity,
            category: post.activity.category || undefined,
          })
        : undefined,
    };

    // Include analytics if requested
    if (includeAnalytics) {
      postResponse.analytics = PostAnalyticsDto.fromPostData(post);
    }

    return postResponse;
  }
}

export class PaginatedPostResponseDto {
  data: PostResponseDto[];

  total: number;

  page: number;

  totalPages: number;

  static fromPaginatedPosts(result: any): PaginatedPostResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}

export class PostFeelingResponseDto {
  id: string;
  label: string;
  icon: string;

  constructor(partial: Partial<PostFeelingResponseDto>) {
    Object.assign(this, partial);
  }

  static fromModel(model: any): PostFeelingResponseDto {
    return {
      id: model.id,
      label: model.label,
      icon: model.icon,
    };
  }
}

export class PostActivityCategoryResponseDto {
  id: string;
  name: string;
  icon: string;

  constructor(partial: Partial<PostActivityCategoryResponseDto>) {
    Object.assign(this, partial);
  }

  static fromModel(model: any): PostActivityCategoryResponseDto {
    return {
      id: model.id,
      name: model.name,
      icon: model.icon,
    };
  }
}

export class PostActivityResponseDto {
  id: string;
  label: string;
  icon: string;
  categoryId: string;
  category?: PostActivityCategoryResponseDto;

  constructor(partial: Partial<PostActivityResponseDto>) {
    Object.assign(this, partial);
  }

  static fromModel(model: any): PostActivityResponseDto {
    return {
      id: model.id,
      label: model.label,
      icon: model.icon,
      categoryId: model.categoryId,
      category: model.category
        ? PostActivityCategoryResponseDto.fromModel(model.category)
        : undefined,
    };
  }
}
