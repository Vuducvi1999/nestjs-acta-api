import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../users/users.decorator';
import { JwtPayload } from '../../auth/jwt-payload';
import { PaymentsService } from './payments.service';
import {
  InitiatePaymentDto,
  PaymentResponseDto,
  PaymentStatusResponseDto,
  PaymentCompletionResponseDto,
  ManualVerifyPaymentDto,
  PaymentVerificationRequestDto,
} from './dto/payment-response.dto';
import { RefundsService } from './refunds.service';
import { RefundableAmountResponseDto } from './dto/refund.dto';
import { RefundResponseDto } from './dto/refund.dto';

@ApiBearerAuth()
@ApiTags('Payments')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundsService: RefundsService,
  ) {}

  @Post('create')
  @ApiOperation({
    summary: 'Initiate payment - Step 2',
    description: 'Create a new payment session for an order (VietQR, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initiated successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid payment data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createPayment(
    @CurrentUser() user: JwtPayload,
    @Body() request: InitiatePaymentDto,
  ): Promise<PaymentResponseDto> {
    console.log(request);
    // Add userId to request for idempotency check
    const requestWithUser = { ...request, userId: user.id };
    return this.paymentsService.createPayment(requestWithUser);
  }

  @Post(':paymentId/verify')
  @ApiOperation({
    summary: 'Verify payment - Step 3',
    description: 'Verify and complete a payment (webhook or manual)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment verification completed',
    type: PaymentCompletionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment not found or invalid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Param('paymentId') paymentId: string,
    @Body() body: ManualVerifyPaymentDto,
  ): Promise<PaymentCompletionResponseDto> {
    // For manual verification (dev/backoffice)
    const verificationRequest: PaymentVerificationRequestDto = {
      paymentId,
      provider: 'vietqr', // Default to VietQR for manual verification
      amount: body.amount,
      currency: 'VND',
      providerRef: body.providerRef,
      rawPayload: {
        manualVerification: true,
        verifiedBy: user.id,
        succeed: body.succeed,
      },
    };

    return this.paymentsService.verifyPayment(verificationRequest);
  }

  @Get(':paymentId/status')
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Get current status of a payment for polling',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved successfully',
    type: PaymentStatusResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getPaymentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('paymentId') paymentId: string,
  ): Promise<PaymentStatusResponseDto> {
    return this.paymentsService.getPaymentStatus(paymentId);
  }

  @Post(':paymentId/complete')
  @ApiOperation({
    summary: 'Complete payment',
    description: 'Complete a cash payment (COD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment completed successfully',
    type: PaymentCompletionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment not found or invalid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async completePayment(
    @CurrentUser() user: JwtPayload,
    @Param('paymentId') paymentId: string,
    @Body() body: { orderId: string },
  ): Promise<PaymentCompletionResponseDto> {
    return this.paymentsService.completePayment(paymentId, body.orderId);
  }

  @Post(':paymentId/cancel')
  @ApiOperation({
    summary: 'Cancel payment',
    description: 'Cancel a payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment cancelled successfully',
    type: PaymentCompletionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment not found or invalid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async cancelPayment(
    @CurrentUser() user: JwtPayload,
    @Param('paymentId') paymentId: string,
    @Body() body: { orderId: string },
  ): Promise<PaymentCompletionResponseDto> {
    return this.paymentsService.cancelPayment(paymentId, body.orderId);
  }

  @Get(':paymentId/refundable-amount')
  @ApiOperation({
    summary: 'Get refundable amount for payment',
    description: 'Get the amount available for refund for a succeeded payment',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID',
    example: 'pay_1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Refundable amount retrieved successfully',
    type: RefundableAmountResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - payment not found or not in succeeded status',
  })
  async getRefundableAmount(
    @Param('paymentId') paymentId: string,
  ): Promise<RefundableAmountResponseDto> {
    return await this.refundsService.getRefundableAmount(paymentId);
  }

  @Get(':paymentId/refunds')
  @ApiOperation({
    summary: 'Get refunds for payment',
    description: 'Get all refunds for a specific payment',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment ID',
    example: 'pay_1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Refunds retrieved successfully',
    type: [RefundResponseDto],
  })
  async getRefundsForPayment(
    @Param('paymentId') paymentId: string,
  ): Promise<RefundResponseDto[]> {
    return await this.refundsService.getRefundsForPayment(paymentId);
  }
}
