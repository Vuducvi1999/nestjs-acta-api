import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { NotificationAction, RelatedModel, ReactionType } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { Ack } from '../common/decorators/ack.decorator';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { WEBSOCKET_EVENTS } from './posts.constants';
import { PostService } from './posts.service';
import { ReactionsService } from './reactions.service';
import { PrismaService } from '../common/services/prisma.service';
import { CommentsService } from './comments.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PostsGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PostsGateway.name);

  constructor(
    private readonly postService: PostService,
    private readonly commentsService: CommentsService,
    private readonly reactionsService: ReactionsService,
    private readonly notificationService: NotificationQueueService,
    private readonly prisma: PrismaService,
  ) {}

  @SubscribeMessage(WEBSOCKET_EVENTS.CREATE_POST)
  async handleCreatePost(
    @MessageBody() data: { dto: CreatePostDto; userId: string },
    @Ack()
    callback: (
      response: PostResponseDto | { success: boolean; message: string },
    ) => void,
  ): Promise<void> {
    try {
      const result = await this.postService.createPost(
        data.dto,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Create Post Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to create post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.UPDATE_POST)
  async handleUpdatePost(
    @MessageBody() data: { postId: string; userId: string; dto: UpdatePostDto },
    @Ack()
    callback: (
      response: PostResponseDto | { success: boolean; message: string },
    ) => void,
  ): Promise<void> {
    try {
      const result = await this.postService.updatePost(
        data.postId,
        data.dto,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Update Post Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to update post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.PUBLISH_POST)
  async handlePublishPost(
    @MessageBody() data: { postId: string; userId: string },
    @Ack()
    callback: (
      response: PostResponseDto | { success: boolean; message: string },
    ) => void,
  ): Promise<void> {
    try {
      const result = await this.postService.publishPost(
        data.postId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Publish Post Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to publish post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.UNPUBLISH_POST)
  async handleUnpublishPost(
    @MessageBody() data: { postId: string; userId: string },
    @Ack()
    callback: (
      response: PostResponseDto | { success: boolean; message: string },
    ) => void,
  ): Promise<void> {
    try {
      const result = await this.postService.unpublishPost(
        data.postId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Unpublish Post Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to unpublish post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.REJECT_POST)
  async handleRejectPost(
    @MessageBody() data: { postId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      const result = await this.postService.rejectPost(
        data.postId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Reject Post Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to reject post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.DELETE_POST)
  async handleDeletePost(
    @MessageBody() data: { postId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      const result = await this.postService.deletePost(
        data.postId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Delete Post Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to delete post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.USER_REACT)
  async handleUserReact(
    @MessageBody()
    data: { postId: string; userId: string; reactionType: ReactionType },
    @Ack()
    callback: (response: {
      success: boolean;
      message: string;
      postId?: string;
    }) => void,
  ): Promise<void> {
    try {
      // Get post with owner information
      const post = await this.postService.findOne(data.postId);

      if (!post) {
        callback({
          success: false,
          message: 'Post not found',
          postId: data.postId,
        });
        return;
      }

      // Add/update reaction
      const result = await this.reactionsService.addOrUpdateReaction(
        data.postId,
        data.userId,
        data.reactionType,
        this.server,
      );

      // Get reactor user information
      const reactor = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, fullName: true },
      });

      // Create notification for post owner (if reactor is not the post owner)
      if (post.user.id !== data.userId) {
        this.logger.log(
          `Adding notification to queue for post owner ${post.user.id} from reactor ${data.userId}`,
        );

        const message = reactor
          ? `${reactor.fullName} đã thích bài viết của bạn`
          : 'Someone liked your post';

        // Thêm notification vào queue thay vì tạo trực tiếp
        await this.notificationService.addToQueue(
          post.user.id,
          RelatedModel.post,
          data.postId,
          NotificationAction.liked,
          message,
          `/posts/${data.postId}`,
          'normal', // Priority
        );

        this.logger.log(
          `Notification added to queue successfully for post ${data.postId}`,
        );

        // Emit socket event to post owner
        this.logger.log(`Emitting POST_LIKED event to user ${post.user.id}`);
        this.logger.log(`Event data:`, {
          postId: data.postId,
          reactionId: result.postId,
          reactorName: reactor?.fullName || 'Someone',
          message,
        });
        this.server.to(post.user.id).emit(WEBSOCKET_EVENTS.POST_LIKED, {
          postId: data.postId,
          reactionId: result.postId, // This will be the reaction ID
          reactorName: reactor?.fullName || 'Someone',
          message,
        });
        this.logger.log(`POST_LIKED event emitted successfully`);
      } else {
        this.logger.log(
          `Reactor ${data.userId} is the post owner ${post.user.id}, skipping notification`,
        );
      }

      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - User React Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to react to post',
        postId: data.postId,
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.USER_UNREACT)
  async handleUserUnreact(
    @MessageBody() data: { postId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      const result = await this.reactionsService.removeReaction(
        data.postId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - User Unreact Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to remove reaction from post',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.ADD_COMMENT)
  async handleAddComment(
    @MessageBody()
    data: {
      postId: string;
      userId: string;
      content: string;
      parentId?: string;
    },
    @Ack()
    callback: (response: {
      success: boolean;
      message: string;
      comment?: any;
    }) => void,
  ): Promise<void> {
    try {
      const result = await this.commentsService.addComment(
        { content: data.content, parentId: data.parentId },
        data.postId,
        data.userId,
        this.server,
      );
      callback({
        success: true,
        message: 'Comment added successfully',
        comment: result,
      });
    } catch (error) {
      this.logger.error(`WebSocket - Add Comment Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to add comment',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.DELETE_COMMENT)
  async handleDeleteComment(
    @MessageBody() data: { commentId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      const result = await this.commentsService.deleteComment(
        data.commentId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - Delete Comment Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to delete comment',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.EDIT_COMMENT)
  async handleEditComment(
    @MessageBody()
    data: {
      commentId: string;
      content: string;
      userId: string;
      postId: string;
    },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      await this.commentsService.updateComment(
        data.commentId,
        { content: data.content },
        data.userId,
        this.server,
      );
      callback({
        success: true,
        message: 'Comment updated successfully',
      });
    } catch (error) {
      this.logger.error(`WebSocket - Edit Comment Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to edit comment',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.COMMENT_REACTIONS_UPDATED)
  async handleReactComment(
    @MessageBody()
    data: {
      commentId: string;
      userId: string;
      postId: string;
      reactionType?: ReactionType;
    },
    @Ack()
    callback: (response: {
      success: boolean;
      message: string;
      comment?: any;
    }) => void,
  ): Promise<void> {
    try {
      const result = await this.commentsService.reactComment(
        data.commentId,
        data.userId,
        data.postId,
        data.reactionType,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(`WebSocket - React Comment Error: ${error.message}`);
      callback({
        success: false,
        message: 'Failed to react to comment',
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.COMMENT_REACTION_ADDED)
  async handleAddOrUpdateCommentReaction(
    @MessageBody()
    data: { commentId: string; userId: string; reactionType: ReactionType },
    @Ack()
    callback: (response: {
      success: boolean;
      message: string;
      commentId?: string;
    }) => void,
  ): Promise<void> {
    try {
      const result = await this.reactionsService.addOrUpdateCommentReaction(
        data.commentId,
        data.userId,
        data.reactionType,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(
        `WebSocket - Add/Update Comment Reaction Error: ${error.message}`,
      );
      callback({
        success: false,
        message: 'Failed to add or update comment reaction',
        commentId: data.commentId,
      });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.COMMENT_REACTION_REMOVED)
  async handleRemoveCommentReaction(
    @MessageBody()
    data: { commentId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      const result = await this.reactionsService.removeCommentReaction(
        data.commentId,
        data.userId,
        this.server,
      );
      callback(result);
    } catch (error) {
      this.logger.error(
        `WebSocket - Remove Comment Reaction Error: ${error.message}`,
      );
      callback({
        success: false,
        message: 'Failed to remove comment reaction',
      });
    }
  }
}
