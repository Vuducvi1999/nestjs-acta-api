import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PaymentProcessingStatus } from '@prisma/client';

export interface PaymentEventData {
  paymentId: string;
  orderId: string;
  status?: PaymentProcessingStatus;
  message?: string;
  expiresAt?: Date;
  amount?: number;
  reason?: string;
  webhookData?: any;
  result?: any;
  minutesLeft?: number;
  userId?: string;
}

export interface PaymentEvent {
  type: string;
  data: PaymentEventData;
  timestamp: string;
}

@Injectable()
export class PaymentEventsService {
  private readonly logger = new Logger(PaymentEventsService.name);
  private readonly eventSubject = new Subject<PaymentEvent>();

  // Observable for other services to subscribe to
  get events$() {
    return this.eventSubject.asObservable();
  }

  // Payment status update events
  emitPaymentStatusUpdate(
    paymentId: string,
    orderId: string,
    status: PaymentProcessingStatus,
    message: string,
    expiresAt?: Date,
  ) {
    this.eventSubject.next({
      type: 'payment.status.update',
      data: {
        paymentId,
        orderId,
        status,
        message,
        expiresAt,
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitPaymentSuccess(paymentId: string, orderId: string, amount: number) {
    this.eventSubject.next({
      type: 'payment.success',
      data: {
        paymentId,
        orderId,
        amount,
        message: 'Payment completed successfully',
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitPaymentFailure(paymentId: string, orderId: string, reason: string) {
    this.eventSubject.next({
      type: 'payment.failure',
      data: {
        paymentId,
        orderId,
        reason,
        message: 'Payment failed',
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitPaymentExpiryWarning(
    paymentId: string,
    orderId: string,
    minutesLeft: number,
  ) {
    this.eventSubject.next({
      type: 'payment.expiry.warning',
      data: {
        paymentId,
        orderId,
        minutesLeft,
        message: `Payment expires in ${minutesLeft} minutes`,
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitWebhookReceived(paymentId: string, orderId: string, webhookData: any) {
    this.eventSubject.next({
      type: 'payment.webhook.received',
      data: {
        paymentId,
        orderId,
        webhookData,
        message: 'Payment webhook received from bank',
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitWebhookProcessed(paymentId: string, orderId: string, result: any) {
    this.eventSubject.next({
      type: 'payment.webhook.processed',
      data: {
        paymentId,
        orderId,
        result,
        message: 'Payment webhook processed successfully',
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitUserPaymentConfirmation(
    paymentId: string,
    orderId: string,
    userId: string,
  ) {
    this.eventSubject.next({
      type: 'payment.user.confirmation',
      data: {
        paymentId,
        orderId,
        userId,
        message: 'User confirmed payment completion',
      },
      timestamp: new Date().toISOString(),
    });
  }

  emitUserPaymentCancellation(
    paymentId: string,
    orderId: string,
    userId: string,
  ) {
    this.eventSubject.next({
      type: 'payment.user.cancellation',
      data: {
        paymentId,
        orderId,
        userId,
        message: 'User cancelled payment',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
