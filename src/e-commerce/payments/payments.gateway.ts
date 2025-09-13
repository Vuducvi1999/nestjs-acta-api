import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Ack } from '../../common/decorators/ack.decorator';
import { PrismaService } from '../../common/services/prisma.service';
import { PaymentsService } from './payments.service';
import { PaymentEventsService } from './payment-events.service';
import { PAYMENT_WEBSOCKET_EVENTS, PAYMENT_ROOMS } from './payments.constants';
import { PaymentProcessingStatus, PaymentStatus } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/payments',
})
@Injectable()
export class PaymentsGateway implements OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentsGateway.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly paymentEvents: PaymentEventsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Payments WebSocket Gateway initialized');
  }

  onModuleInit() {
    // Subscribe to payment events and emit them via WebSocket
    this.paymentEvents.events$.subscribe((event) => {
      switch (event.type) {
        case 'payment.status.update':
          this.emitPaymentStatusUpdate(
            event.data.paymentId,
            event.data.status!,
            event.data.message!,
            event.data.expiresAt,
          );
          break;
        case 'payment.success':
          this.emitPaymentSuccess(
            event.data.paymentId,
            event.data.orderId,
            event.data.amount!,
          );
          break;
        case 'payment.failure':
          this.emitPaymentFailure(
            event.data.paymentId,
            event.data.orderId,
            event.data.reason!,
          );
          break;
        case 'payment.expiry.warning':
          this.emitPaymentExpiryWarning(
            event.data.paymentId,
            event.data.orderId,
            event.data.minutesLeft!,
          );
          break;
        case 'payment.webhook.received':
          this.emitWebhookReceived(
            event.data.paymentId,
            event.data.orderId,
            event.data.webhookData,
          );
          break;
        case 'payment.webhook.processed':
          this.emitWebhookProcessed(
            event.data.paymentId,
            event.data.orderId,
            event.data.result,
          );
          break;
        case 'payment.user.confirmation':
          this.emitUserPaymentConfirmation(
            event.data.paymentId,
            event.data.orderId,
            event.data.userId!,
          );
          break;
        case 'payment.user.cancellation':
          this.emitUserPaymentCancellation(
            event.data.paymentId,
            event.data.orderId,
            event.data.userId!,
          );
          break;
      }
    });
  }

  /**
   * Join user to their payment monitoring room
   */
  @SubscribeMessage('join_user_payments')
  async handleJoinUserPayments(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const room = PAYMENT_ROOMS.USER_PAYMENTS(data.userId);
      await client.join(room);

      this.logger.log(`User ${data.userId} joined payment room: ${room}`);

      // Send current payment statuses
      const userPayments = await this.prisma.payment.findMany({
        where: {
          orderPayment: {
            order: {
              customer: {
                userId: data.userId,
              },
            },
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Last 10 payments
      });

      client.emit('user_payments_status', {
        payments: userPayments.map((payment) => ({
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          orderId: payment.orderPayment?.orderId,
          orderCode: payment.orderPayment?.order?.code,
          expiresAt: payment.expiresAt,
          provider: payment.provider,
        })),
      });
    } catch (error) {
      this.logger.error(`Error joining user payments room: ${error.message}`);
      client.emit('error', { message: 'Failed to join payment room' });
    }
  }

  /**
   * Join order payment monitoring room
   */
  @SubscribeMessage('join_order_payments')
  async handleJoinOrderPayments(
    @MessageBody() data: { orderId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      // Verify user has access to this order
      const order = await this.prisma.order.findFirst({
        where: {
          id: data.orderId,
          customer: {
            userId: data.userId,
          },
        },
      });

      if (!order) {
        client.emit('error', { message: 'Access denied to order' });
        return;
      }

      const room = PAYMENT_ROOMS.ORDER_PAYMENTS(data.orderId);
      await client.join(room);

      this.logger.log(`User ${data.userId} joined order payment room: ${room}`);

      // Send current order payment status
      const orderPayment = await this.prisma.payment.findFirst({
        where: {
          orderPayment: {
            orderId: data.orderId,
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (orderPayment) {
        client.emit('order_payment_status', {
          paymentId: orderPayment.id,
          status: orderPayment.status,
          amount: orderPayment.amount,
          expiresAt: orderPayment.expiresAt,
          provider: orderPayment.provider,
          orderCode: orderPayment.orderPayment?.order?.code,
        });
      }
    } catch (error) {
      this.logger.error(`Error joining order payments room: ${error.message}`);
      client.emit('error', { message: 'Failed to join order payment room' });
    }
  }

  /**
   * Join specific payment monitoring room
   */
  @SubscribeMessage('join_payment_monitoring')
  async handleJoinPaymentMonitoring(
    @MessageBody() data: { paymentId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      // Verify user has access to this payment
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: data.paymentId,
          orderPayment: {
            order: {
              customer: {
                userId: data.userId,
              },
            },
          },
        },
      });

      if (!payment) {
        client.emit('error', { message: 'Access denied to payment' });
        return;
      }

      const room = PAYMENT_ROOMS.PAYMENT_MONITORING(data.paymentId);
      await client.join(room);

      this.logger.log(
        `User ${data.userId} joined payment monitoring room: ${room}`,
      );

      // Send current payment status
      client.emit('payment_status', {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        expiresAt: payment.expiresAt,
        provider: payment.provider,
      });
    } catch (error) {
      this.logger.error(
        `Error joining payment monitoring room: ${error.message}`,
      );
      client.emit('error', {
        message: 'Failed to join payment monitoring room',
      });
    }
  }

  /**
   * User confirms they have made payment
   */
  @SubscribeMessage('confirm_payment')
  async handleConfirmPayment(
    @MessageBody() data: { paymentId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      // Verify user has access to this payment
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: data.paymentId,
          orderPayment: {
            order: {
              customer: {
                userId: data.userId,
              },
            },
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        callback({
          success: false,
          message: 'Payment not found or access denied',
        });
        return;
      }

      // Emit payment confirmation event
      this.server
        .to(PAYMENT_ROOMS.PAYMENT_MONITORING(data.paymentId))
        .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CONFIRMATION, {
          paymentId: data.paymentId,
          userId: data.userId,
          timestamp: new Date().toISOString(),
          message: 'User confirmed payment completion',
        });

      // Also emit to order room
      if (payment.orderPayment?.orderId) {
        this.server
          .to(PAYMENT_ROOMS.ORDER_PAYMENTS(payment.orderPayment.orderId))
          .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CONFIRMATION, {
            paymentId: data.paymentId,
            userId: data.userId,
            orderId: payment.orderPayment.orderId,
            timestamp: new Date().toISOString(),
            message: 'User confirmed payment completion',
          });
      }

      callback({ success: true, message: 'Payment confirmation received' });
    } catch (error) {
      this.logger.error(
        `Error handling payment confirmation: ${error.message}`,
      );
      callback({ success: false, message: 'Failed to confirm payment' });
    }
  }

  /**
   * User cancels payment
   */
  @SubscribeMessage('cancel_payment')
  async handleCancelPayment(
    @MessageBody() data: { paymentId: string; userId: string },
    @Ack()
    callback: (response: { success: boolean; message: string }) => void,
  ): Promise<void> {
    try {
      // Verify user has access to this payment
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: data.paymentId,
          orderPayment: {
            order: {
              customer: {
                userId: data.userId,
              },
            },
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        callback({
          success: false,
          message: 'Payment not found or access denied',
        });
        return;
      }

      // Emit payment cancellation event
      this.server
        .to(PAYMENT_ROOMS.PAYMENT_MONITORING(data.paymentId))
        .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CANCELLATION, {
          paymentId: data.paymentId,
          userId: data.userId,
          timestamp: new Date().toISOString(),
          message: 'User cancelled payment',
        });

      // Also emit to order room
      if (payment.orderPayment?.orderId) {
        this.server
          .to(PAYMENT_ROOMS.ORDER_PAYMENTS(payment.orderPayment.orderId))
          .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CANCELLATION, {
            paymentId: data.paymentId,
            userId: data.userId,
            orderId: payment.orderPayment.orderId,
            timestamp: new Date().toISOString(),
            message: 'User cancelled payment',
          });
      }

      callback({ success: true, message: 'Payment cancellation received' });
    } catch (error) {
      this.logger.error(
        `Error handling payment cancellation: ${error.message}`,
      );
      callback({ success: false, message: 'Failed to cancel payment' });
    }
  }

  /**
   * Request payment status update
   */
  @SubscribeMessage('request_payment_status')
  async handleRequestPaymentStatus(
    @MessageBody() data: { paymentId: string; userId: string },
    @Ack()
    callback: (response: {
      success: boolean;
      message: string;
      status?: any;
    }) => void,
  ): Promise<void> {
    try {
      // Verify user has access to this payment
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: data.paymentId,
          orderPayment: {
            order: {
              customer: {
                userId: data.userId,
              },
            },
          },
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (!payment) {
        callback({
          success: false,
          message: 'Payment not found or access denied',
        });
        return;
      }

      // Get current payment status
      const status = await this.paymentsService.getPaymentStatus(
        data.paymentId,
      );

      callback({
        success: true,
        message: 'Payment status retrieved',
        status,
      });

      // Emit status update to all users monitoring this payment
      this.server
        .to(PAYMENT_ROOMS.PAYMENT_MONITORING(data.paymentId))
        .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_STATUS_UPDATE, {
          paymentId: data.paymentId,
          status: status.status,
          message: status.message,
          expiresAt: status.expiresAt,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      this.logger.error(`Error requesting payment status: ${error.message}`);
      callback({ success: false, message: 'Failed to get payment status' });
    }
  }

  /**
   * Leave payment monitoring room
   */
  @SubscribeMessage('leave_payment_monitoring')
  async handleLeavePaymentMonitoring(
    @MessageBody() data: { paymentId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const room = PAYMENT_ROOMS.PAYMENT_MONITORING(data.paymentId);
      await client.leave(room);

      this.logger.log(
        `User ${data.userId} left payment monitoring room: ${room}`,
      );
    } catch (error) {
      this.logger.error(
        `Error leaving payment monitoring room: ${error.message}`,
      );
    }
  }

  /**
   * Leave order payments room
   */
  @SubscribeMessage('leave_order_payments')
  async handleLeaveOrderPayments(
    @MessageBody() data: { orderId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const room = PAYMENT_ROOMS.ORDER_PAYMENTS(data.orderId);
      await client.leave(room);

      this.logger.log(`User ${data.userId} left order payments room: ${room}`);
    } catch (error) {
      this.logger.error(`Error leaving order payments room: ${error.message}`);
    }
  }

  /**
   * Leave user payments room
   */
  @SubscribeMessage('leave_user_payments')
  async handleLeaveUserPayments(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    try {
      const room = PAYMENT_ROOMS.USER_PAYMENTS(data.userId);
      await client.leave(room);

      this.logger.log(`User ${data.userId} left user payments room: ${room}`);
    } catch (error) {
      this.logger.error(`Error leaving user payments room: ${error.message}`);
    }
  }

  // Public methods for emitting events from other services

  /**
   * Emit payment status update to all monitoring users
   */
  emitPaymentStatusUpdate(
    paymentId: string,
    status: PaymentProcessingStatus,
    message: string,
    expiresAt?: Date,
  ) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_STATUS_UPDATE, {
        paymentId,
        status,
        message,
        expiresAt,
        timestamp: new Date().toISOString(),
      });
  }

  /**
   * Emit payment success to all monitoring users
   */
  emitPaymentSuccess(paymentId: string, orderId: string, amount: number) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_SUCCEEDED, {
        paymentId,
        orderId,
        amount,
        timestamp: new Date().toISOString(),
        message: 'Payment completed successfully',
      });

    // Also emit to order room
    this.server
      .to(PAYMENT_ROOMS.ORDER_PAYMENTS(orderId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.ORDER_PAYMENT_RECEIVED, {
        paymentId,
        orderId,
        amount,
        timestamp: new Date().toISOString(),
        message: 'Payment received for order',
      });
  }

  /**
   * Emit payment failure to all monitoring users
   */
  emitPaymentFailure(paymentId: string, orderId: string, reason: string) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_FAILED, {
        paymentId,
        orderId,
        reason,
        timestamp: new Date().toISOString(),
        message: 'Payment failed',
      });

    // Also emit to order room
    this.server
      .to(PAYMENT_ROOMS.ORDER_PAYMENTS(orderId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_FAILED, {
        paymentId,
        orderId,
        reason,
        timestamp: new Date().toISOString(),
        message: 'Payment failed for order',
      });
  }

  /**
   * Emit payment expiry warning
   */
  emitPaymentExpiryWarning(
    paymentId: string,
    orderId: string,
    minutesLeft: number,
  ) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_EXPIRY_WARNING, {
        paymentId,
        orderId,
        minutesLeft,
        timestamp: new Date().toISOString(),
        message: `Payment expires in ${minutesLeft} minutes`,
      });

    // Also emit to order room
    this.server
      .to(PAYMENT_ROOMS.ORDER_PAYMENTS(orderId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.PAYMENT_EXPIRY_WARNING, {
        paymentId,
        orderId,
        minutesLeft,
        timestamp: new Date().toISOString(),
        message: `Payment expires in ${minutesLeft} minutes`,
      });
  }

  /**
   * Emit webhook received notification
   */
  emitWebhookReceived(paymentId: string, orderId: string, webhookData: any) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.WEBHOOK_RECEIVED, {
        paymentId,
        orderId,
        webhookData,
        timestamp: new Date().toISOString(),
        message: 'Payment webhook received from bank',
      });
  }

  /**
   * Emit webhook processed notification
   */
  emitWebhookProcessed(paymentId: string, orderId: string, result: any) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.WEBHOOK_PROCESSED, {
        paymentId,
        orderId,
        result,
        timestamp: new Date().toISOString(),
        message: 'Payment webhook processed successfully',
      });
  }

  /**
   * Emit user payment confirmation
   */
  emitUserPaymentConfirmation(
    paymentId: string,
    orderId: string,
    userId: string,
  ) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CONFIRMATION, {
        paymentId,
        orderId,
        userId,
        timestamp: new Date().toISOString(),
        message: 'User confirmed payment completion',
      });

    // Also emit to order room
    this.server
      .to(PAYMENT_ROOMS.ORDER_PAYMENTS(orderId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CONFIRMATION, {
        paymentId,
        orderId,
        userId,
        timestamp: new Date().toISOString(),
        message: 'User confirmed payment completion',
      });
  }

  /**
   * Emit user payment cancellation
   */
  emitUserPaymentCancellation(
    paymentId: string,
    orderId: string,
    userId: string,
  ) {
    this.server
      .to(PAYMENT_ROOMS.PAYMENT_MONITORING(paymentId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CANCELLATION, {
        paymentId,
        orderId,
        userId,
        timestamp: new Date().toISOString(),
        message: 'User cancelled payment',
      });

    // Also emit to order room
    this.server
      .to(PAYMENT_ROOMS.ORDER_PAYMENTS(orderId))
      .emit(PAYMENT_WEBSOCKET_EVENTS.USER_PAYMENT_CANCELLATION, {
        paymentId,
        orderId,
        userId,
        timestamp: new Date().toISOString(),
        message: 'User cancelled payment',
      });
  }
}
