import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { NotificationAction } from '@prisma/client';
import { WEBSOCKET_EVENTS } from '../posts/posts.constants';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AuthGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuthGateway.name);

  emitNewDirectReferral(userId: string) {
    if (this.server) {
      this.logger.log(`Emitting NEW_DIRECT_REFERRAL to user ${userId}`);
      this.server.to(userId).emit(WEBSOCKET_EVENTS.NEW_DIRECT_REFERRAL);
    } else {
      this.logger.warn('Socket server not available for direct referral');
    }
  }

  emitNewIndirectReferral(userId: string) {
    if (this.server) {
      this.logger.log(`Emitting NEW_INDIRECT_REFERRAL to user ${userId}`);
      this.server.to(userId).emit(WEBSOCKET_EVENTS.NEW_INDIRECT_REFERRAL);
    } else {
      this.logger.warn('Socket server not available for indirect referral');
    }
  }

  emitPendingApprovalNotification(
    referrerId: string,
    newUserData: any,
    notificationId?: string,
  ) {
    if (this.server) {
      this.logger.log(
        `Emitting direct referral verified notification to referrer ${referrerId}`,
      );
      this.server
        .to(referrerId)
        .emit(WEBSOCKET_EVENTS.NEW_DIRECT_REFERRAL_VERIFIED, {
          type: NotificationAction.direct_referral_verified,
          message: `Bạn có người giới thiệu mới cần phê duyệt: ${newUserData.fullName}`,
          userId: newUserData.id,
          referrerId: referrerId,
          timestamp: new Date(),
          notificationId: notificationId,
          userData: {
            id: newUserData.id,
            fullName: newUserData.fullName,
            email: newUserData.email,
            phoneNumber: newUserData.phoneNumber,
            referenceId: newUserData.referenceId,
          },
        });
    } else {
      this.logger.warn(
        'Socket server not available for direct referral verified notification',
      );
    }
  }
}
