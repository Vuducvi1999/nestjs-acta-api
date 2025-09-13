import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  NotificationAction,
  ReactionType,
  RelatedModel,
} from '@prisma/client';
import { Server } from 'socket.io';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { PrismaService } from '../common/services/prisma.service';
import {
  CommentResponseDto,
  CreatePostCommentDto,
  UpdatePostCommentDto,
} from './dto/comment.dto';
import { WEBSOCKET_EVENTS } from './posts.constants';
import { PostHelpers } from './posts.helpers';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
  ) {}

  async addComment(
    createCommentDto: CreatePostCommentDto,
    postId: string,
    userId: string,
    server?: Server,
  ): Promise<CommentResponseDto> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validateCommentContent(createCommentDto.content);

      // Verify post exists and get post owner info
      const post = await this.prisma.post.findUnique({
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

      // If it's a reply, verify parent comment exists
      if (createCommentDto.parentId) {
        const parentComment = await this.prisma.comment.findUnique({
          where: { id: createCommentDto.parentId },
        });

        if (!parentComment) {
          throw new NotFoundException('Parent comment not found');
        }
      }

      const newComment = await this.prisma.comment.create({
        data: {
          content: createCommentDto.content.trim(),
          userId,
          postId,
          parentId: createCommentDto.parentId,
        },
        include: PostHelpers.getCommentIncludeClause(),
      });

      // Update comment count
      await this.prisma.post.update({
        where: { id: postId },
        data: {
          commentCount: {
            increment: 1,
          },
        },
      });

      // Log the activity
      await this.activityLogService.createActivityLog(
        newComment.id,
        'POST',
        ActivityType.POST_COMMENTED,
        user,
        `User ${user.referenceId} commented on post ${postId}`,
        {
          postId,
          commentId: newComment.id,
          content: createCommentDto.content.trim(),
        },
      );

      // Create notification for post owner (if commenter is not the post owner)
      if (post.userId !== userId) {
        await this.notificationService.createNotification({
          userId: post.userId,
          relatedModel: RelatedModel.post,
          relatedModelId: postId,
          action: NotificationAction.commented,
          message: `${user.fullName} đã bình luận bài viết của bạn`,
          linkUrl: `/posts/${postId}`,
        });

        // Emit socket event to post owner
        if (server) {
          server.to(post.userId).emit(WEBSOCKET_EVENTS.POST_COMMENTED, {
            postId,
            commentId: newComment.id,
            commenterName: user.fullName,
            message: `${user.fullName} đã bình luận bài viết của bạn`,
          });
        }
      }

      const commentResponse = CommentResponseDto.fromComment(newComment);

      // Broadcast the new comment via Socket.IO if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.COMMENT_ADDED, {
          postId,
          comment: commentResponse,
        });
      }

      return commentResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'add comment', this.logger);
    }
  }

  async updateComment(
    commentId: string,
    updateCommentDto: UpdatePostCommentDto,
    userId: string,
    server?: Server,
  ): Promise<CommentResponseDto> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);
      PostHelpers.validateCommentContent(updateCommentDto.content);

      // Find the comment and verify ownership
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          post: true,
        },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      // Check if user can edit the comment (only owner can edit)
      if (comment.userId !== userId) {
        throw new NotFoundException('You can only edit your own comments');
      }

      // Update the comment
      const updatedComment = await this.prisma.comment.update({
        where: { id: commentId },
        data: { content: updateCommentDto.content.trim() },
        include: PostHelpers.getCommentIncludeClause(),
      });

      // Log the activity
      await this.activityLogService.createActivityLog(
        commentId,
        'POST',
        ActivityType.POST_COMMENTED,
        user,
        `User ${user.referenceId} edited a comment on post ${comment.postId}`,
        {
          postId: comment.postId,
          commentId,
          content: updateCommentDto.content.trim(),
        },
      );

      const commentResponse = CommentResponseDto.fromComment(updatedComment);

      // Broadcast the comment update via Socket.IO if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.COMMENT_UPDATED, {
          postId: comment.postId,
          comment: commentResponse,
        });
      }

      return commentResponse;
    } catch (error) {
      PostHelpers.handleError(error, 'update comment', this.logger);
    }
  }

  async deleteComment(
    commentId: string,
    userId: string,
    server?: Server,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);

      // Find the comment and verify ownership or admin rights
      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          post: true,
          replies: {
            include: {
              replies: {
                include: {
                  replies: {
                    include: {
                      replies: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      // Check if user can delete the comment (owner or admin)
      PostHelpers.validateCommentOwnership(comment, userId, user.role);

      // Count total comments to be deleted (comment + all nested replies)
      const totalCommentsToDelete = PostHelpers.countNestedComments(comment);

      // Delete the comment (cascade will handle replies)
      await this.prisma.comment.delete({
        where: { id: commentId },
      });

      // Update comment count
      await this.prisma.post.update({
        where: { id: comment.postId },
        data: {
          commentCount: {
            decrement: totalCommentsToDelete,
          },
        },
      });

      // Ensure comment count doesn't go below 0
      await this.prisma.post.updateMany({
        where: {
          id: comment.postId,
          commentCount: { lt: 0 },
        },
        data: {
          commentCount: 0,
        },
      });

      // Log the activity
      await this.activityLogService.createActivityLog(
        commentId,
        'POST',
        ActivityType.POST_COMMENT_DELETED,
        user,
        `User ${user.referenceId} deleted a comment from post ${comment.postId}`,
        { postId: comment.postId, commentId },
      );

      // Broadcast the comment deletion via Socket.IO if server is provided
      if (server) {
        server.emit(WEBSOCKET_EVENTS.COMMENT_DELETED, {
          postId: comment.postId,
          commentId,
        });
      }

      return {
        success: true,
        message: 'Comment deleted successfully',
      };
    } catch (error) {
      PostHelpers.handleError(error, 'delete comment', this.logger);
    }
  }

  async getTopLevelComments(
    postId: string,
    page = 1,
    limit = 10,
    currentUserId?: string,
  ): Promise<CommentResponseDto[]> {
    try {
      const skip = (page - 1) * limit;

      const comments = await this.prisma.comment.findMany({
        where: {
          postId,
          parentId: null,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: PostHelpers.getCommentIncludeClause(),
      });

      return comments.map((comment) =>
        CommentResponseDto.fromComment(comment, currentUserId),
      );
    } catch (error) {
      PostHelpers.handleError(error, 'get top-level comments', this.logger);
    }
  }

  async getReplies(
    parentId: string,
    page = 1,
    limit = 10,
    currentUserId?: string,
  ): Promise<CommentResponseDto[]> {
    try {
      const skip = (page - 1) * limit;

      const replies = await this.prisma.comment.findMany({
        where: {
          parentId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: PostHelpers.getCommentIncludeClause(),
      });

      return replies.map((reply) =>
        CommentResponseDto.fromComment(reply, currentUserId),
      );
    } catch (error) {
      PostHelpers.handleError(error, 'get replies', this.logger);
    }
  }

  async reactComment(
    commentId: string,
    userId: string,
    postId: string,
    reactionType: ReactionType | undefined,
    server?: Server,
  ): Promise<{ success: boolean; message: string; comment?: any }> {
    try {
      const user = await PostHelpers.validateAndFetchUser(this.prisma, userId);

      const comment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        include: PostHelpers.getCommentIncludeClause(),
      });

      if (!comment) throw new NotFoundException('Comment not found');

      const existing = await this.prisma.commentLike.findUnique({
        where: { userId_commentId: { userId, commentId } },
      });

      let action: 'added' | 'updated' | 'removed' = 'added';

      if (reactionType) {
        if (existing) {
          await this.prisma.commentLike.update({
            where: { userId_commentId: { userId, commentId } },
            data: { type: reactionType },
          });
          action = 'updated';
        } else {
          await this.prisma.commentLike.create({
            data: { userId, commentId, type: reactionType },
          });
        }
      } else if (existing) {
        await this.prisma.commentLike.delete({
          where: { userId_commentId: { userId, commentId } },
        });
        action = 'removed';
      }

      // Sync like count
      const totalReactions = await this.prisma.commentLike.count({
        where: { commentId },
      });
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { likeCount: totalReactions },
      });

      const updatedComment = await this.prisma.comment.findUnique({
        where: { id: commentId },
        include: PostHelpers.getCommentIncludeClause(),
      });

      const commentResponse = CommentResponseDto.fromComment(
        updatedComment,
        userId,
      );

      // Emit fine-grained events
      if (server && updatedComment && commentResponse?.reactions) {
        const targetReaction = commentResponse.reactions.find(
          (r) => r.userId === userId,
        );

        switch (action) {
          case 'added':
            server.emit(WEBSOCKET_EVENTS.COMMENT_REACTION_ADDED, {
              commentId,
              postId,
              reaction: targetReaction,
            });
            break;
          case 'updated':
            server.emit(WEBSOCKET_EVENTS.COMMENT_REACTION_UPDATED, {
              commentId,
              postId,
              reaction: targetReaction,
            });
            break;
          case 'removed':
            server.emit(WEBSOCKET_EVENTS.COMMENT_REACTION_REMOVED, {
              commentId,
              postId,
              userId,
            });
            break;
        }
      }

      return {
        success: true,
        message: `Comment reaction ${action} successfully`,
        comment: commentResponse,
      };
    } catch (error) {
      PostHelpers.handleError(error, 'react to comment', this.logger);
    }
  }
}
