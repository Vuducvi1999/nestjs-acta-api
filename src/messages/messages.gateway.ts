import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { PrismaService } from '../common/services/prisma.service';
import { WEBSOCKET_EVENTS } from './messages.constants';
import { MessagesSocketEmitterService } from './services/messages-socket-emitter.service';

export interface JoinConversationPayload {
  conversationId: string;
  userId: string;
}

export interface LeaveConversationPayload {
  conversationId: string;
  userId: string;
}

export interface TypingStatusPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface SendMessagePayload {
  conversationId: string;
  content?: string;
  imageUrls?: string[];
  mentionIds?: string[];
  attachmentIds?: string[];
  senderId: string; // extracted from token/user context
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
    private readonly messagesSocketEmitter: MessagesSocketEmitterService,
  ) {}

  afterInit() {
    this.messagesSocketEmitter.setServer(this.server);
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.JOIN_CONVERSATION)
  async handleJoinConversation(
    @MessageBody() payload: JoinConversationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Join the conversation room
      await client.join(payload.conversationId);

      // Store conversation info in socket data
      client.data.conversationId = payload.conversationId;
      client.data.userId = payload.userId;

      // joined room successfully

      return { success: true, message: 'Joined conversation successfully' };
    } catch (error) {
      this.logger.error(`Error joining conversation: ${error.message}`);
      return { success: false, message: 'Failed to join conversation' };
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.LEAVE_CONVERSATION)
  async handleLeaveConversation(
    @MessageBody() payload: LeaveConversationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // Leave the conversation room
      await client.leave(payload.conversationId);

      // Clear conversation info from socket data
      delete client.data.conversationId;

      this.logger.log(
        `User ${payload.userId} left conversation ${payload.conversationId}`,
      );

      return { success: true, message: 'Left conversation successfully' };
    } catch (error) {
      this.logger.error(`Error leaving conversation: ${error.message}`);
      return { success: false, message: 'Failed to leave conversation' };
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      // received SEND_MESSAGE

      const message = await this.messagesService.handleSendMessage(payload);

      // message created

      // Broadcast to all in conversation
      this.server
        .to(payload.conversationId)
        .emit(WEBSOCKET_EVENTS.NEW_MESSAGE, message);

      // Notify sender that message was sent
      client.emit(WEBSOCKET_EVENTS.MESSAGE_SENT, message);

      // Optional: notify others if needed
      this.server
        .to(payload.conversationId)
        .emit(WEBSOCKET_EVENTS.NOTIFICATION_NEW_MESSAGE, {
          conversationId: payload.conversationId,
          preview: message.content || message.imageUrls,
        });

      // broadcasted to room
      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.MESSAGE_READ)
  async handleMessageRead(
    @MessageBody()
    {
      messageId,
      userId,
      conversationId,
    }: {
      messageId: string;
      userId: string;
      conversationId: string;
    },
  ) {
    // received MESSAGE_READ

    try {
      await this.messagesService.markMessageAsRead(messageId, userId);

      // marked single message as read

      // Broadcast to all users in the conversation
      this.server.to(conversationId).emit(WEBSOCKET_EVENTS.MESSAGE_READ, {
        messageId,
        userId,
        conversationId,
      });

      // broadcasted MESSAGE_READ

      return { success: true, message: 'Message marked as read' };
    } catch (error) {
      this.logger.error(`Error marking message as read: ${error.message}`);
      return { success: false, message: 'Failed to mark message as read' };
    }
  }

  @SubscribeMessage('MARK_ALL_MESSAGES_READ')
  async handleMarkAllMessagesRead(
    @MessageBody()
    { conversationId, userId }: { conversationId: string; userId: string },
  ) {
    // received MARK_ALL_MESSAGES_READ

    try {
      const result = await this.messagesService.markAllMessagesAsRead(
        conversationId,
        userId,
      );

      // marked all messages as read

      // Broadcast to all users in the conversation
      this.server.to(conversationId).emit('ALL_MESSAGES_READ', {
        conversationId,
        userId,
        updatedCount: result.updatedCount,
      });

      // broadcasted ALL_MESSAGES_READ

      return {
        success: true,
        message: 'All messages marked as read',
        updatedCount: result.updatedCount,
      };
    } catch (error) {
      this.logger.error(`Error marking all messages as read: ${error.message}`);
      return { success: false, message: 'Failed to mark all messages as read' };
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.USER_TYPING)
  async handleUserTyping(
    @MessageBody() { conversationId, userId }: TypingStatusPayload,
  ) {
    try {
      await this.messagesService.updateTypingStatus(
        conversationId,
        userId,
        true,
      );
      this.server
        .to(conversationId)
        .emit(WEBSOCKET_EVENTS.USER_TYPING, { conversationId, userId });

      return { success: true, message: 'Typing status updated' };
    } catch (error) {
      this.logger.error(`Error updating typing status: ${error.message}`);
      return { success: false, message: 'Failed to update typing status' };
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.USER_STOP_TYPING)
  async handleUserStoppedTyping(
    @MessageBody() { conversationId, userId }: TypingStatusPayload,
  ) {
    try {
      await this.messagesService.updateTypingStatus(
        conversationId,
        userId,
        false,
      );
      this.server
        .to(conversationId)
        .emit(WEBSOCKET_EVENTS.USER_STOP_TYPING, { conversationId, userId });

      return { success: true, message: 'Typing status updated' };
    } catch (error) {
      this.logger.error(`Error updating typing status: ${error.message}`);
      return { success: false, message: 'Failed to update typing status' };
    }
  }
}
