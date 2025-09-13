import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WEBSOCKET_EVENTS } from '../../posts/posts.constants';
import { PostResponseDto } from '../../posts/dto/post-response.dto';

@Injectable()
export class SocketEmitterService {
  private readonly logger = new Logger(SocketEmitterService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
    this.logger.log('Socket server set in SocketEmitterService');
  }

  emitNewPost(post: PostResponseDto) {
    if (!this.server) {
      this.logger.warn('Socket server not available, cannot emit newPost event');
      return;
    }

    try {
      this.server.emit(WEBSOCKET_EVENTS.NEW_POST, post);
      this.logger.log(`Emitted newPost event for post ${post.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit newPost event: ${error.message}`);
    }
  }

  emitPostUpdated(post: PostResponseDto) {
    if (!this.server) {
      this.logger.warn('Socket server not available, cannot emit postUpdated event');
      return;
    }

    try {
      this.server.emit(WEBSOCKET_EVENTS.POST_UPDATED, post);
      this.logger.log(`Emitted postUpdated event for post ${post.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit postUpdated event: ${error.message}`);
    }
  }

  emitPostDeleted(postId: string) {
    if (!this.server) {
      this.logger.warn('Socket server not available, cannot emit postDeleted event');
      return;
    }

    try {
      this.server.emit(WEBSOCKET_EVENTS.POST_DELETED, { id: postId });
      this.logger.log(`Emitted postDeleted event for post ${postId}`);
    } catch (error) {
      this.logger.error(`Failed to emit postDeleted event: ${error.message}`);
    }
  }
}
