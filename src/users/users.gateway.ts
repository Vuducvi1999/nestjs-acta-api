import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { NotificationAction, RelatedModel } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { Ack } from '../common/decorators/ack.decorator';
import { NotificationService } from '../notifications/notification.service';
import { WEBSOCKET_EVENTS } from '../posts/posts.constants';
import { CreateKYCDto } from './dto/create-kyc.dto';
import { SocketEmitterService } from './services/socket-emitter.service';
import { UserService } from './services/user.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class UsersGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UsersGateway.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly socketEmitterService: SocketEmitterService,
  ) {}

  afterInit() {
    this.logger.log('UsersGateway afterInit called');
    this.socketEmitterService.setServer(this.server);
  }

  @SubscribeMessage('joinUserRoom')
  async handleJoinUserRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      if (data.userId) {
        // Join the user's personal room
        await client.join(data.userId);

        // Store user info in socket data for future reference
        client.data.userId = data.userId;

        this.logger.log(`User ${data.userId} joined their personal room`);

        return { success: true, message: 'Joined user room successfully' };
      }
    } catch (error) {
      this.logger.error(`Error joining user room: ${error.message}`);
      return { success: false, message: 'Failed to join user room' };
    }
  }

  @SubscribeMessage('joinAdminRoom')
  async handleJoinAdminRoom(
    @MessageBody() data: { userId: string; role: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      if (data.role === 'admin') {
        // Join the admin room
        await client.join('admins');

        // Store user info in socket data for future reference
        client.data.userId = data.userId;
        client.data.role = data.role;

        this.logger.log(`Admin user ${data.userId} joined admin room`);

        return { success: true, message: 'Joined admin room successfully' };
      }
    } catch (error) {
      this.logger.error(`Error joining admin room: ${error.message}`);
      return { success: false, message: 'Failed to join admin room' };
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.KYC_SUBMITTED)
  async handleKycSubmitted(
    @MessageBody()
    data: { userId: string; kycData: CreateKYCDto },
    @Ack()
    callback: (response: {
      success: boolean;
      message: string;
      kycId?: string;
    }) => void,
  ) {
    try {
      const { userId, kycData } = data;

      this.logger.log(
        `🚀 [KYC WebSocket] Starting KYC submission for user ${userId}`,
      );
      this.logger.log(`📝 [KYC WebSocket] KYC data received:`, kycData);

      if (!userId || !kycData) {
        this.logger.error(
          `❌ [KYC WebSocket] Missing required data - userId: ${userId}, kycData: ${!!kycData}`,
        );
        callback({
          success: false,
          message: 'User ID and KYC data are required',
        });
        return;
      }

      this.logger.log(`✅ [KYC WebSocket] Validation passed, creating KYC...`);

      // 1. Create KYC information using user service
      const kycResult = await this.userService.createKYC(userId, kycData);

      this.logger.log(`📋 [KYC WebSocket] KYC creation result:`, kycResult);

      if (!kycResult.success) {
        this.logger.error(
          `❌ [KYC WebSocket] KYC creation failed: ${kycResult.message}`,
        );
        callback({
          success: false,
          message: kycResult.message || 'Failed to create KYC',
        });
        return;
      }

      this.logger.log(
        `✅ [KYC WebSocket] KYC created successfully with ID: ${kycResult.kycId}`,
      );

      // 2. Get information of admin users
      const adminUsers = await this.userService.findAdminUsers();
      this.logger.log(
        `👥 [KYC WebSocket] Found ${adminUsers.length} admin users to notify`,
      );

      // 3. Create notifications for admin users
      const notificationPromises = adminUsers.map((admin) =>
        this.notificationService.createNotification({
          userId: admin.id,
          relatedModel: RelatedModel.user,
          relatedModelId: userId,
          action: NotificationAction.kyc_submitted,
          message: `Có KYC vừa được gửi bởi ${kycData.fullName}`,
          linkUrl: `/admin/users?userId=${userId}`,
        }),
      );

      await Promise.all(notificationPromises);
      this.logger.log(
        `📢 [KYC WebSocket] Notifications created for ${adminUsers.length} admin users`,
      );

      // 4. Socket emit notificationKycSubmitted to admin users
      this.server.to('admins').emit('notificationKycSubmitted', {
        type: 'kyc_submitted',
        message: `Có KYC vừa được gửi bởi ${kycData.fullName}`,
        userId: userId,
        kycId: kycResult.kycId,
        timestamp: new Date(),
        userData: {
          id: userId,
          fullName: kycData.fullName,
        },
      });

      this.logger.log(
        `📡 [KYC WebSocket] WebSocket event emitted to admin room`,
      );

      this.logger.log(
        `✅ [KYC WebSocket] KYC created and notifications sent to ${adminUsers.length} admin users`,
      );

      callback({
        success: true,
        message: 'KYC submitted successfully',
        kycId: kycResult.kycId,
      });
    } catch (error) {
      this.logger.error(
        `💥 [KYC WebSocket] KYC Submitted Error: ${error.message}`,
      );
      this.logger.error(`💥 [KYC WebSocket] Error stack: ${error.stack}`);
      callback({ success: false, message: 'Failed to process KYC submission' });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.KYC_ADMIN_ACTION)
  async handleKycAdminAction(
    @MessageBody()
    data: {
      kycId: string;
      action: 'approve' | 'requestChange';
      adminId: string;
      message?: string;
    },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ) {
    try {
      const { kycId, action, adminId, message } = data;

      this.logger.log(`🚀 [KYC Admin WebSocket] Starting KYC admin action`);
      this.logger.log(`📝 [KYC Admin WebSocket] Action data:`, {
        kycId,
        action,
        adminId,
        message,
      });

      if (!kycId || !action || !adminId) {
        this.logger.error(
          `❌ [KYC Admin WebSocket] Missing required data - kycId: ${kycId}, action: ${action}, adminId: ${adminId}`,
        );
        callback({
          success: false,
          message: 'KYC ID, action, and admin ID are required',
        });
        return;
      }

      this.logger.log(
        `✅ [KYC Admin WebSocket] Validation passed, performing KYC action...`,
      );

      // Perform KYC action using user service
      const result = await this.userService.performKYCActionByAdmin(
        kycId,
        action,
        adminId,
        message,
      );

      this.logger.log(`📋 [KYC Admin WebSocket] KYC action result:`, result);

      if (!result.success) {
        this.logger.error(
          `❌ [KYC Admin WebSocket] KYC action failed: ${result.message}`,
        );
        callback({
          success: false,
          message: result.message || 'Failed to perform KYC action',
        });
        return;
      }

      this.logger.log(
        `✅ [KYC Admin WebSocket] KYC action successful, getting KYC record...`,
      );

      // Get KYC record to get userId for the WebSocket event
      const kycRecord = await this.userService.getKYCById(kycId);
      if (!kycRecord) {
        this.logger.error(
          `❌ [KYC Admin WebSocket] KYC record not found after action: ${kycId}`,
        );
        callback({
          success: false,
          message: 'KYC record not found after action',
        });
        return;
      }

      this.logger.log(
        `✅ [KYC Admin WebSocket] KYC record found for user: ${kycRecord.user.id}`,
      );

      // Emit KYC status update only to the specific user
      const statusType = action === 'approve' ? 'kyc_approved' : 'kyc_changing';
      const statusMessage =
        action === 'approve'
          ? 'Thông tin KYC của bạn đã được phê duyệt'
          : `Thông tin KYC của bạn cần sự thay đổi: ${message || ''}`;

      this.logger.log(
        `📡 [KYC Admin WebSocket] Emitting KYC status update to user ${kycRecord.user.id}`,
      );

      this.server
        .to(kycRecord.user.id)
        .emit(WEBSOCKET_EVENTS.KYC_STATUS_UPDATE, {
          type: statusType,
          message: statusMessage,
          userId: kycRecord.user.id,
          kycId: kycId,
          timestamp: new Date(),
          action: action,
          adminId: adminId,
        });

      this.logger.log(
        `✅ [KYC Admin WebSocket] KYC admin action completed: ${action} for KYC ${kycId} by admin ${adminId}`,
      );
      callback({ success: true, message: `KYC ${action} successfully` });
    } catch (error) {
      this.logger.error(
        `💥 [KYC Admin WebSocket] KYC Admin Action Error: ${error.message}`,
      );
      this.logger.error(`💥 [KYC Admin WebSocket] Error stack: ${error.stack}`);
      callback({ success: false, message: 'Failed to perform KYC action' });
    }
  }

  @SubscribeMessage(WEBSOCKET_EVENTS.KYC_STATUS_UPDATE)
  async handleKycStatusUpdate(
    @MessageBody()
    data: { userId: string; kycId: string; status: string; message: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ) {
    try {
      const { userId, kycId, status, message } = data;
      this.server.emit(WEBSOCKET_EVENTS.KYC_STATUS_UPDATE, {
        type: status === 'approved' ? 'kyc_approved' : 'kyc_changing',
        message,
        userId,
        kycId,
        timestamp: new Date(),
      });

      this.logger.log(
        `KYC status update emitted: ${status} for user ${userId}`,
      );
      callback({ success: true, message: 'KYC status update emitted' });
    } catch (error) {
      this.logger.error(
        `WebSocket - KYC Status Update Error: ${error.message}`,
      );
      callback({ success: false, message: 'Failed to emit KYC status update' });
    }
  }

  // Handle client disconnection
  handleDisconnect(client: Socket) {
    if (client.data.userId && client.data.role === 'admin') {
      this.logger.log(`Admin user ${client.data.userId} disconnected`);
    }
  }
}
