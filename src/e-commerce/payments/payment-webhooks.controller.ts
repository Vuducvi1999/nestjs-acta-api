import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Logger,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { WebhookSignatureHelper } from './helpers/webhook-signature.helper';
import {
  VietQRWebhookDto,
  PaymentVerificationRequestDto,
} from './dto/payment-response.dto';

@ApiTags('Payment Webhooks')
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  private readonly logger = new Logger(PaymentWebhooksController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly webhookSignatureHelper: WebhookSignatureHelper,
  ) {}

  @Post('vietqr/:paymentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'VietQR payment webhook',
    description: 'Handle VietQR payment callbacks with signature validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid signature or payload',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid signature',
  })
  async handleVietQRWebhook(
    @Param('paymentId') paymentId: string,
    @Body() body: VietQRWebhookDto,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log(`VietQR webhook received for payment ${paymentId}`);
      this.logger.debug('Webhook body:', body);
      this.logger.debug('Webhook headers:', headers);

      // Validate webhook signature
      const payload = JSON.stringify(body);
      const isValidSignature = this.webhookSignatureHelper.verifyVietQRWebhook(
        payload,
        headers,
      );

      if (!isValidSignature) {
        this.logger.warn(`Invalid webhook signature for payment ${paymentId}`);
        throw new BadRequestException('Invalid webhook signature');
      }

      // Validate required fields
      if (!body.reference || !body.amount || !body.transactionId) {
        throw new BadRequestException('Missing required webhook fields');
      }

      // Check if payment is already cancelled and expired (late webhook)
      const payment = await this.paymentsService['prisma'].payment.findUnique({
        where: { id: paymentId },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
        },
      });

      if (payment) {
        if (
          payment.status === 'cancelled' &&
          payment.expiresAt &&
          new Date() > payment.expiresAt
        ) {
          this.logger.log(
            `Payment ${paymentId} is cancelled and expired, ignoring late webhook`,
          );
          // Return 200 to prevent webhook retries (no-op)
          return {
            success: true,
            message: 'Payment already cancelled and expired, webhook ignored',
            paymentStatus: payment.status,
            paymentId: payment.id,
            orderId: payment.orderPayment?.orderId,
          };
        }

        if (payment.status === 'succeeded') {
          this.logger.log(
            `Payment ${paymentId} already succeeded, webhook ignored (idempotent)`,
          );
          // Return 200 to prevent webhook retries (idempotent)
          return {
            success: true,
            message: 'Payment already succeeded, webhook ignored',
            paymentStatus: payment.status,
            paymentId: payment.id,
            orderId: payment.orderPayment?.orderId,
          };
        }
      }

      // Process payment verification using integrated webhook handling
      const result = await this.paymentsService.handleVietQRWebhook(body);

      this.logger.log(
        `VietQR webhook processed successfully for payment ${paymentId}`,
      );

      return {
        success: true,
        message: 'Webhook processed successfully',
        paymentStatus: result.status,
        paymentId: result.paymentId,
        orderId: result.orderId,
      };
    } catch (error) {
      this.logger.error(`Error processing VietQR webhook: ${error.message}`);

      // Always return 200 to prevent webhook retries (idempotency)
      return {
        success: false,
        message: 'Webhook processed with errors',
        error: error.message,
      };
    }
  }

  @Post('vietqr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'VietQR payment webhook (without paymentId)',
    description:
      'Handle VietQR payment callbacks by resolving payment from reference',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid signature or payload',
  })
  async handleVietQRWebhookByReference(
    @Body() body: VietQRWebhookDto,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log(
        `VietQR webhook received with reference ${body.reference}`,
      );
      this.logger.debug('Webhook body:', body);
      this.logger.debug('Webhook headers:', headers);

      // Validate webhook signature
      const payload = JSON.stringify(body);
      const isValidSignature = this.webhookSignatureHelper.verifyVietQRWebhook(
        payload,
        headers,
      );

      if (!isValidSignature) {
        this.logger.warn(
          `Invalid webhook signature for reference ${body.reference}`,
        );
        throw new BadRequestException('Invalid webhook signature');
      }

      // Validate required fields
      if (!body.reference || !body.amount || !body.transactionId) {
        throw new BadRequestException('Missing required webhook fields');
      }

      // Find payment by reference (order code)
      const payment = await this.paymentsService['prisma'].payment.findFirst({
        where: {
          orderPayment: {
            order: {
              code: body.reference.replace('ACTA ', ''), // Remove "ACTA " prefix
            },
          },
          provider: 'vietqr',
          status: 'pending',
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
        this.logger.warn(`Payment not found for reference ${body.reference}`);
        throw new BadRequestException('Payment not found for reference');
      }

      // Check if payment is already cancelled and expired (late webhook)
      if (
        payment.status === 'cancelled' &&
        payment.expiresAt &&
        new Date() > payment.expiresAt
      ) {
        this.logger.log(
          `Payment ${payment.id} is cancelled and expired, ignoring late webhook`,
        );
        // Return 200 to prevent webhook retries (no-op)
        return {
          success: true,
          message: 'Payment already cancelled and expired, webhook ignored',
          paymentStatus: payment.status,
          paymentId: payment.id,
          orderId: payment.orderPayment?.orderId,
        };
      }

      if (payment.status === 'succeeded') {
        this.logger.log(
          `Payment ${payment.id} already succeeded, webhook ignored (idempotent)`,
        );
        // Return 200 to prevent webhook retries (idempotent)
        return {
          success: true,
          message: 'Payment already succeeded, webhook ignored',
          paymentStatus: payment.status,
          paymentId: payment.id,
          orderId: payment.orderPayment?.orderId,
        };
      }

      // Process payment verification using integrated webhook handling
      const result = await this.paymentsService.handleVietQRWebhook(body);

      this.logger.log(
        `VietQR webhook processed successfully for payment ${payment.id}`,
      );

      return {
        success: true,
        message: 'Webhook processed successfully',
        paymentStatus: result.status,
        paymentId: result.paymentId,
        orderId: result.orderId,
      };
    } catch (error) {
      this.logger.error(`Error processing VietQR webhook: ${error.message}`);

      // Always return 200 to prevent webhook retries (idempotency)
      return {
        success: false,
        message: 'Webhook processed with errors',
        error: error.message,
      };
    }
  }

  @Post('stripe/:paymentId')
  @ApiOperation({
    summary: 'Stripe payment webhook',
    description: 'Handle Stripe payment callbacks',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleStripeWebhook(
    @Param('paymentId') paymentId: string,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log(`Stripe webhook received for payment ${paymentId}`);
      this.logger.debug('Webhook body:', body);
      this.logger.debug('Webhook headers:', headers);

      // In a real implementation, you would:
      // 1. Verify the webhook signature using Stripe's SDK
      // 2. Parse the payment status from the webhook
      // 3. Update the payment status accordingly

      // For now, we'll just return a placeholder response
      return {
        success: true,
        message: 'Stripe webhook received (not implemented yet)',
        paymentId,
      };
    } catch (error) {
      this.logger.error(`Error processing Stripe webhook: ${error.message}`);
      throw error;
    }
  }

  @Post('test/:paymentId')
  @ApiOperation({
    summary: 'Test payment webhook',
    description: 'Test webhook endpoint for development',
  })
  @ApiResponse({
    status: 200,
    description: 'Test webhook processed successfully',
  })
  async handleTestWebhook(
    @Param('paymentId') paymentId: string,
    @Body() body: any,
  ) {
    try {
      this.logger.log(`Test webhook received for payment ${paymentId}`);
      this.logger.debug('Test webhook body:', body);

      // Simulate payment verification
      const verificationRequest: PaymentVerificationRequestDto = {
        paymentId,
        provider: 'vietqr',
        amount: body.amount || 480000,
        currency: 'VND',
        providerRef: body.providerRef || 'test_transaction_123',
        rawPayload: body,
      };

      const result =
        await this.paymentsService.verifyPayment(verificationRequest);

      return {
        success: true,
        message: 'Test webhook processed successfully',
        paymentStatus: result.status,
        paymentId: result.paymentId,
        orderId: result.orderId,
      };
    } catch (error) {
      this.logger.error(`Error processing test webhook: ${error.message}`);
      throw error;
    }
  }
}
