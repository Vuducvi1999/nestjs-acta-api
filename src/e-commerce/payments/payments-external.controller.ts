import {
  Body,
  Controller,
  Logger,
  Post,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ExternalCompletePaymentDto } from './dto/external-complete.dto';
import { AffiliateQueueService } from './affiliate-queue.service';
import { ConfigService } from '@nestjs/config';
import { ExternalApp } from '../../common/decorators/external-app.decorator';

@ApiTags('Payments External')
@Controller('payments-external')
export class PaymentsExternalController {
  private readonly logger = new Logger(PaymentsExternalController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly affiliateQueue: AffiliateQueueService,
    private readonly configService: ConfigService,
  ) {}

  @Post('complete')
  @ExternalApp()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete payment and order from SePay webhook' })
  @ApiResponse({ status: 200, description: 'Completed successfully' })
  async completePayment(@Body() body: ExternalCompletePaymentDto) {
    this.logger.log(`SePay webhook received: ${JSON.stringify(body)}`);

    // Extract order code from content or code field
    // Priority: 1. code field, 2. description with ORD prefix, 3. content with ACT/ORD prefix
    let orderCode: string;

    if (body.code) {
      orderCode = body.code;
    } else {
      // Try to extract order code from description first (with ORD prefix)
      let orderMatch = body.description.match(/\b(ORD\w+)/i);

      if (!orderMatch) {
        // If not found in description, try content with ACT or ORD prefix
        orderMatch = body.content.match(/\b(ACT\w+|ORD\w+)/i);
      }

      if (!orderMatch) {
        this.logger.error(
          `Cannot extract order code from content: ${body.content} or description: ${body.description}`,
        );
        throw new Error('Cannot extract order code from webhook payload');
      }
      orderCode = orderMatch[1];
    }

    this.logger.log(`Extracted order code: ${orderCode} from SePay webhook`);

    const result = await this.paymentsService.completeByOrderCode(
      orderCode,
      body,
    );

    // Enqueue affiliate job (order completed)
    await this.affiliateQueue.enqueueOrderCompleted(result.orderId);

    return {
      success: result.success,
      orderId: result.orderId,
      paymentId: result.paymentId,
      status: result.status,
      message:
        result.message || 'Payment and order completed via SePay webhook',
      sePayTransactionId: body.id,
      transferAmount: body.transferAmount,
    };
  }
}
