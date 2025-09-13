import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { WEBSOCKET_EVENTS } from '../messages.constants';
import { ConversationResponseDto } from '../dto/conversations-response.dto';

@Injectable()
export class MessagesSocketEmitterService {
  private readonly logger = new Logger(MessagesSocketEmitterService.name);
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
    this.logger.log('Socket server set in MessagesSocketEmitterService');
  }

  emitConversationCreatedToUsers(
    userIds: string[],
    conversation: ConversationResponseDto,
  ) {
    if (!this.server) {
      this.logger.warn(
        'Socket server not available, cannot emit conversationCreated',
      );
      return;
    }

    try {
      userIds.forEach((userId) => {
        this.server!.to(userId).emit(
          WEBSOCKET_EVENTS.CONVERSATION_CREATED,
          conversation,
        );
      });
      this.logger.log(
        `Emitted conversationCreated for conversation ${conversation.id} to users: ${userIds.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Failed to emit conversationCreated: ${error.message}`);
    }
  }

  emitConversationUpdatedToUsers(
    userIds: string[],
    conversation: ConversationResponseDto,
  ) {
    if (!this.server) {
      this.logger.warn(
        'Socket server not available, cannot emit conversationUpdated',
      );
      return;
    }

    try {
      userIds.forEach((userId) => {
        this.server!.to(userId).emit(
          WEBSOCKET_EVENTS.CONVERSATION_UPDATED,
          conversation,
        );
      });
      this.logger.log(
        `Emitted conversationUpdated for conversation ${conversation.id} to users: ${userIds.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Failed to emit conversationUpdated: ${error.message}`);
    }
  }

  emitNewMessageToConversation(conversationId: string, message: any) {
    if (!this.server) {
      this.logger.warn('Socket server not available, cannot emit newMessage');
      return;
    }

    try {
      this.server
        .to(conversationId)
        .emit(WEBSOCKET_EVENTS.NEW_MESSAGE, message);
      this.logger.log(
        `Emitted newMessage to conversation room ${conversationId} for message ${message?.id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to emit newMessage: ${error.message}`);
    }
  }
}
