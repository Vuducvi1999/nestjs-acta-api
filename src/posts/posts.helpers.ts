import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import { PostQueryDto } from './dto/post-query.dto';
import {
  POST_SORT_MODES,
  USER_SELECT_FIELDS_WITH_AUTH,
} from './posts.constants';

export class PostHelpers {
  private static readonly logger = new Logger(PostHelpers.name);

  /**
   * Generate cache key for posts
   */
  static generatePostsCacheKey(query: PostQueryDto): string {
    return `documents:${JSON.stringify(query)}`;
  }

  /**
   * Generate cache key for a single post
   */
  static generatePostCacheKey(postId: string): string {
    return `post:${postId}`;
  }

  /**
   * Validate and fetch user by ID
   */
  static async validateAndFetchUser(prisma: PrismaService, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT_FIELDS_WITH_AUTH,
    });

    if (!user) {
      throw new NotFoundException('User not authenticated');
    }

    return user;
  }

  /**
   * Check if user has admin permissions
   */
  static validateAdminPermission(user: any): void {
    if (user.role !== Role.admin) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }
  }

  /**
   * Validate post content
   */
  static validatePostContent(
    content?: string,
    imageUrls?: string[],
    videoUrls?: string[],
  ): void {
    if (
      !content?.trim() &&
      (!imageUrls || imageUrls.length === 0) &&
      (!videoUrls || videoUrls.length === 0)
    ) {
      throw new BadRequestException('Post content cannot be empty');
    }
  }

  /**
   * Validate comment content
   */
  static validateCommentContent(content?: string): void {
    if (!content?.trim()) {
      throw new BadRequestException('Comment content cannot be empty');
    }
  }

  /**
   * Validate tagged users exist
   */
  static async validateTaggedUsers(
    prisma: PrismaService,
    taggedUserIds?: string[],
  ): Promise<void> {
    if (!taggedUserIds || taggedUserIds.length === 0) {
      return;
    }

    // Check if all tagged users exist and are not deleted
    const existingUsers = await prisma.user.findMany({
      where: {
        id: { in: taggedUserIds },
        deletedAt: null,
      },
      select: { id: true },
    });

    const existingUserIds = existingUsers.map((user) => user.id);
    const nonExistentUserIds = taggedUserIds.filter(
      (id) => !existingUserIds.includes(id),
    );

    if (nonExistentUserIds.length > 0) {
      throw new BadRequestException(
        `The following users do not exist or have been deleted: ${nonExistentUserIds.join(', ')}`,
      );
    }
  }

  /**
   * Build where clause for posts query
   */
  static buildPostsWhereClause(query: PostQueryDto): Prisma.PostWhereInput {
    return {
      // Handle publication status based on context
      ...(query.myPosts && query.userId
        ? {
            // For "My Posts": show all posts (published and unpublished) by the user
            userId: query.userId,
          }
        : query.showAll
          ? {}
          : { isPublished: true }), // Default: only published posts
      ...(query.referenceId && {
        user: {
          referenceId: query.referenceId.toLowerCase(),
        },
      }),
      ...(query.locationName && {
        location: {
          address: {
            contains: query.locationName,
            mode: 'insensitive',
          },
        },
      }),
      ...(query.searchQuery && {
        OR: [
          {
            content: {
              contains: query.searchQuery,
              mode: 'insensitive',
            },
          },
          {
            user: {
              fullName: {
                contains: query.searchQuery,
                mode: 'insensitive',
              },
            },
          },
          {
            user: {
              referenceId: {
                contains: query.searchQuery,
                mode: 'insensitive',
              },
            },
          },
        ],
      }),
      ...(query.postId && {
        id: query.postId,
      }),
      ...(query.taggedUserId && {
        taggedUsers: {
          some: {
            id: query.taggedUserId,
          },
        },
      }),
      deletedAt: null, // Ensure we only fetch non-deleted posts
    };
  }

  /**
   * Build order by clause for posts query
   */
  static buildPostsOrderBy(
    mode?: string,
  ): Prisma.PostOrderByWithRelationInput[] {
    switch (mode) {
      case POST_SORT_MODES.LATEST:
      case POST_SORT_MODES.ALL:
      case undefined:
      case null:
        return [{ publishedAt: Prisma.SortOrder.desc }];
      case POST_SORT_MODES.MOST_REACTED:
        return [
          { reactionCount: Prisma.SortOrder.desc },
          { publishedAt: Prisma.SortOrder.desc },
        ];
      case POST_SORT_MODES.MOST_COMMENTED:
        return [
          { commentCount: Prisma.SortOrder.desc },
          { publishedAt: Prisma.SortOrder.desc },
        ];
      default:
        return [{ publishedAt: Prisma.SortOrder.desc }];
    }
  }

  /**
   * Get include clause for posts with related data
   */
  static getPostIncludeClause() {
    return {
      muxData: true,
      location: true,
      savedPosts: {
        select: {
          userId: true,
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
          deletedAt: true,
        },
      },
      reactions: {
        select: {
          id: true,
          type: true,
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

          postId: true,
        },
      },
      comments: {
        where: {
          deletedAt: null,
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
          likes: {
            select: {
              userId: true,
            },
          },
          replies: {
            where: {
              deletedAt: null,
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
              likes: {
                select: {
                  userId: true,
                },
              },
            },
            orderBy: {
              createdAt: Prisma.SortOrder.asc,
            },
          },
        },
        orderBy: {
          createdAt: Prisma.SortOrder.asc,
        },
      },
      feeling: true,
      activity: {
        include: {
          category: true,
        },
      },
    };
  }

  /**
   * Get include clause for comments with related data
   */
  static getCommentIncludeClause() {
    return {
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
      likes: {
        select: {
          id: true,
          type: true,
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

          commentId: true,
        },
      },
      replies: {
        where: {
          deletedAt: null,
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
          likes: {
            select: {
              id: true,
              type: true,
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

              commentId: true,
            },
          },
        },
        orderBy: {
          createdAt: Prisma.SortOrder.asc,
        },
      },
    };
  }

  /**
   * Check if user can edit/delete comment
   */
  static validateCommentOwnership(
    comment: any,
    userId: string,
    userRole: Role,
  ): void {
    if (comment.userId !== userId && userRole !== Role.admin) {
      throw new ForbiddenException('You can only modify your own comments');
    }
  }

  /**
   * Count nested comments recursively
   */
  static countNestedComments(comment: any): number {
    if (!comment) return 0;

    const countReplies = (replies: any[]): number => {
      return replies.reduce((count, reply) => {
        return count + 1 + (reply.replies ? countReplies(reply.replies) : 0);
      }, 0);
    };

    return 1 + countReplies(comment.replies || []);
  }

  /**
   * Format user data for responses
   */
  static formatUserForResponse(user: any) {
    return {
      id: user.id,
      fullName: user.fullName,
      status: user.status,
      avatarUrl: user.avatar?.fileUrl,
      referenceId: user.referenceId,
      verificationDate: user.verificationDate,
      role: user.role,
    };
  }

  /**
   * Handle errors consistently
   */
  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in posts - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }
}
