import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  ReactionType,
  ActivityTargetType,
  NotificationAction,
  RelatedModel,
} from '@prisma/client';
import { Server } from 'socket.io';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { NotificationService } from '../notifications/notification.service';
import { PostHelpers } from './posts.helpers';
import { WEBSOCKET_EVENTS } from './posts.constants';

@Injectable()
export class ReactionsService {
  private readonly logger = new Logger(ReactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
  ) {}

  async addOrUpdateReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType,
    server?: Server,
  ): Promise<{ success: boolean; message: string; postId: string }> {
    // Sử dụng transaction để đảm bảo data consistency
    return await this.prisma.$transaction(async (tx) => {
      try {
        const user = await PostHelpers.validateAndFetchUser(
          this.prisma,
          userId,
        );

        // Kiểm tra existing reaction với transaction
        const existingReaction = await tx.reaction.findFirst({
          where: { postId, userId },
        });

        if (existingReaction) {
          // Update existing reaction
          const updatedReaction = await tx.reaction.update({
            where: { id: existingReaction.id },
            data: { type: reactionType },
          });

          // Log the activity
          await this.activityLogService.createActivityLog(
            updatedReaction.id,
            'POST',
            ActivityType.POST_REACTION_UPDATED,
            user,
            `User ${user.referenceId} updated their reaction on post ${postId}`,
            { postId, reactionType },
          );

          const post = await tx.post.findUnique({
            where: { id: postId },
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          });

          if (!post) {
            throw new NotFoundException('Post not found');
          }

          // Broadcast the updated reaction if server is provided
          if (server) {
            server.emit(WEBSOCKET_EVENTS.REACTION_UPDATED, {
              postId,
              reaction: {
                id: updatedReaction.id,
                type: updatedReaction.type,
                user: PostHelpers.formatUserForResponse(user),
              },
            });
          }

          return {
            success: true,
            message: 'Reaction updated successfully',
            postId,
          };
        } else {
          const post = await tx.post.findUnique({
            where: { id: postId },
          });

          if (!post) {
            throw new NotFoundException('Post not found');
          }

          // Double-check để tránh duplicate (race condition protection)
          const duplicateCheck = await tx.reaction.findFirst({
            where: { postId, userId },
          });

          if (duplicateCheck) {
            // Nếu có duplicate, update thay vì create
            const updatedReaction = await tx.reaction.update({
              where: { id: duplicateCheck.id },
              data: { type: reactionType },
            });

            // Log the activity
            await this.activityLogService.createActivityLog(
              updatedReaction.id,
              'POST',
              ActivityType.POST_REACTION_UPDATED,
              user,
              `User ${user.referenceId} updated their reaction on post ${postId} (duplicate prevention)`,
              { postId, reactionType },
            );

            // Broadcast the updated reaction if server is provided
            if (server) {
              server.emit(WEBSOCKET_EVENTS.REACTION_UPDATED, {
                postId,
                reaction: {
                  id: updatedReaction.id,
                  type: updatedReaction.type,
                  user: PostHelpers.formatUserForResponse(user),
                },
              });
            }

            return {
              success: true,
              message: 'Reaction updated successfully (duplicate prevented)',
              postId,
            };
          }

          // Create new reaction
          const newReaction = await tx.reaction.create({
            data: {
              type: reactionType,
              postId: post.id,
              userId,
            },
          });

          // Update reaction count trong cùng transaction
          await tx.post.update({
            where: { id: postId },
            data: {
              reactionCount: {
                increment: 1,
              },
            },
          });

          // Log the activity
          await this.activityLogService.createActivityLog(
            newReaction.id,
            'POST',
            ActivityType.POST_REACTION_ADDED,
            user,
            `User ${user.referenceId} reacted to post ${postId}`,
            { postId, reactionType },
          );

          // Broadcast the new reaction if server is provided
          if (server) {
            server.emit(WEBSOCKET_EVENTS.REACTION_ADDED, {
              postId,
              reaction: {
                id: newReaction.id,
                type: newReaction.type,
                user: PostHelpers.formatUserForResponse(user),
              },
            });
          }

          return {
            success: true,
            message: 'Reaction added successfully',
            postId,
          };
        }
      } catch (error) {
        PostHelpers.handleError(error, 'react to post', this.logger);
        throw error; // Re-throw để transaction rollback
      }
    });
  }

  async removeReaction(
    postId: string,
    userId: string,
    server?: Server,
  ): Promise<{ success: boolean; message: string }> {
    // Sử dụng transaction để đảm bảo data consistency
    return await this.prisma.$transaction(async (tx) => {
      try {
        const user = await PostHelpers.validateAndFetchUser(
          this.prisma,
          userId,
        );

        const existingReaction = await tx.reaction.findFirst({
          where: { postId, userId },
        });

        if (!existingReaction) {
          throw new NotFoundException('No reaction found to remove');
        }

        await tx.reaction.delete({
          where: { id: existingReaction.id },
        });

        // Decrement reactionCount trong cùng transaction
        await tx.post.update({
          where: { id: postId },
          data: {
            reactionCount: {
              decrement: 1,
            },
          },
        });

        // Ensure reactionCount does not go below 0
        await tx.post.updateMany({
          where: {
            id: postId,
            reactionCount: { lt: 0 },
          },
          data: {
            reactionCount: 0,
          },
        });

        // Log the activity
        await this.activityLogService.createActivityLog(
          existingReaction.id,
          'POST',
          ActivityType.POST_REACTION_REMOVED,
          user,
          `User ${user.referenceId} removed their reaction from post ${postId}`,
          { postId },
        );

        // Broadcast the reaction removal if server is provided
        if (server) {
          server.emit(WEBSOCKET_EVENTS.REACTION_REMOVED, {
            postId,
            reactionId: existingReaction.id,
            userId: user.id,
          });
        }

        return {
          success: true,
          message: 'Reaction removed successfully',
        };
      } catch (error) {
        PostHelpers.handleError(
          error,
          'remove reaction from post',
          this.logger,
        );
        throw error; // Re-throw để transaction rollback
      }
    });
  }

  async addOrUpdateCommentReaction(
    commentId: string,
    userId: string,
    reactionType: ReactionType,
    server?: Server,
  ): Promise<{ success: boolean; message: string; commentId: string }> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);

      const existingReaction = await this.prisma.commentLike.findFirst({
        where: { commentId, userId },
      });

      if (existingReaction) {
        // Update existing reaction
        const updatedReaction = await this.prisma.commentLike.update({
          where: { id: existingReaction.id },
          data: { type: reactionType },
        });

        // Log the activity
        await this.activityLogService.createActivityLog(
          updatedReaction.id,
          ActivityTargetType.POST, // Use POST for comment reactions on posts
          ActivityType.POST_REACTION_UPDATED,
          user,
          `User ${user.referenceId} updated their reaction on comment ${commentId}`,
          { commentId, reactionType },
        );

        const comment = await this.prisma.comment.findUnique({
          where: { id: commentId },
        });

        if (!comment) {
          throw new NotFoundException('Comment not found');
        }

        // Broadcast the updated reaction if server is provided
        if (server) {
          server.emit(WEBSOCKET_EVENTS.COMMENT_REACTION_UPDATED, {
            commentId,
            reaction: {
              id: updatedReaction.id,
              type: updatedReaction.type,
              user: PostHelpers.formatUserForResponse(user),
            },
          });
        }

        return {
          success: true,
          message: 'Comment reaction updated successfully',
          commentId,
        };
      } else {
        const comment = await this.prisma.comment.findUnique({
          where: { id: commentId },
        });

        if (!comment) {
          throw new NotFoundException('Comment not found');
        }

        // Create new reaction
        const newReaction = await this.prisma.commentLike.create({
          data: {
            type: reactionType,
            commentId: comment.id,
            userId,
          },
        });

        await this.prisma.comment.update({
          where: { id: commentId },
          data: {
            likeCount: {
              increment: 1,
            },
          },
        });

        // Log the activity
        await this.activityLogService.createActivityLog(
          newReaction.id,
          ActivityTargetType.POST, // Use POST for comment reactions on posts
          ActivityType.POST_REACTION_ADDED,
          user,
          `User ${user.referenceId} reacted to comment ${commentId}`,
          { commentId, reactionType },
        );

        // Broadcast the new reaction if server is provided
        if (server) {
          server.emit(WEBSOCKET_EVENTS.COMMENT_REACTION_ADDED, {
            commentId,
            reaction: {
              id: newReaction.id,
              type: newReaction.type,
              user: PostHelpers.formatUserForResponse(user),
            },
          });
        }

        return {
          success: true,
          message: 'Comment reaction added successfully',
          commentId,
        };
      }
    } catch (error) {
      PostHelpers.handleError(error, 'react to comment', this.logger);
    }
  }

  async removeCommentReaction(
    commentId: string,
    userId: string,
    server?: Server,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);

      const existingReaction = await this.prisma.commentLike.findFirst({
        where: { commentId, userId },
      });

      if (!existingReaction) {
        throw new NotFoundException('No comment reaction found to remove');
      }

      await this.prisma.commentLike.delete({
        where: { id: existingReaction.id },
      });

      // Decrement likeCount only if it's greater than 0
      await this.prisma.comment.update({
        where: { id: commentId },
        data: {
          likeCount: {
            decrement: 1,
          },
        },
      });

      // Ensure likeCount does not go below 0
      await this.prisma.comment.updateMany({
        where: {
          id: commentId,
          likeCount: { lt: 0 },
        },
        data: {
          likeCount: 0,
        },
      });

      // Log the activity
      await this.activityLogService.createActivityLog(
        existingReaction.id,
        ActivityTargetType.POST,
        ActivityType.POST_REACTION_REMOVED,
        user,
        `User ${user.referenceId} removed their reaction from comment ${commentId}`,
        { commentId },
      );

      // Broadcast the reaction removal if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.COMMENT_REACTION_REMOVED, {
          commentId,
          reactionId: existingReaction.id,
          userId: user.id,
        });
      }

      return {
        success: true,
        message: 'Comment reaction removed successfully',
      };
    } catch (error) {
      PostHelpers.handleError(
        error,
        'remove reaction from comment',
        this.logger,
      );
    }
  }
}
