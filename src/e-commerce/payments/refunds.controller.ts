import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import {
  CreateRefundDto,
  ApproveRefundDto,
  SettleRefundDto,
  RefundResponseDto,
  RefundableAmountResponseDto,
} from './dto/refund.dto';

@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('refunds')
export class RefundsController {
  private readonly logger = new Logger(RefundsController.name);

  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create refund request',
    description:
      'Create a refund request for a succeeded payment (role: support/admin)',
  })
  @ApiResponse({
    status: 201,
    description: 'Refund request created successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid amount or payment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async createRefund(
    @Body() dto: CreateRefundDto,
    @Request() req: any,
  ): Promise<RefundResponseDto> {
    // TODO: Add role-based guard for support/admin
    // @UseGuards(RolesGuard)
    // @Roles('support', 'admin')

    this.logger.log(`Creating refund request for payment ${dto.paymentId}`);
    return await this.refundsService.createRefund(
      dto,
      req.user?.id || 'system',
    );
  }

  @Post(':refundId/approve')
  @ApiOperation({
    summary: 'Approve refund request',
    description:
      'Approve a refund request (two-man approval, role: finance/lead)',
  })
  @ApiParam({
    name: 'refundId',
    description: 'Refund ID',
    example: 'refund_1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund approved successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - refund not found or invalid status',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async approveRefund(
    @Param('refundId') refundId: string,
    @Body() dto: ApproveRefundDto,
    @Request() req: any,
  ): Promise<RefundResponseDto> {
    // TODO: Add role-based guard for finance/lead
    // @UseGuards(RolesGuard)
    // @Roles('finance', 'lead', 'admin')

    this.logger.log(`Approving refund ${refundId}`);
    return await this.refundsService.approveRefund(
      refundId,
      dto,
      req.user?.id || 'system',
    );
  }

  @Post(':refundId/settle')
  @ApiOperation({
    summary: 'Settle refund',
    description:
      'Attach bank proof and mark refund as succeeded (role: finance)',
  })
  @ApiParam({
    name: 'refundId',
    description: 'Refund ID',
    example: 'refund_1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund settled successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - refund not found or invalid status',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async settleRefund(
    @Param('refundId') refundId: string,
    @Body() dto: SettleRefundDto,
    @Request() req: any,
  ): Promise<RefundResponseDto> {
    // TODO: Add role-based guard for finance
    // @UseGuards(RolesGuard)
    // @Roles('finance', 'admin')

    this.logger.log(`Settling refund ${refundId}`);
    return await this.refundsService.settleRefund(
      refundId,
      dto,
      req.user?.id || 'system',
    );
  }

  @Post(':refundId/cancel')
  @ApiOperation({
    summary: 'Cancel refund request',
    description: 'Cancel a refund request (role: support/admin)',
  })
  @ApiParam({
    name: 'refundId',
    description: 'Refund ID',
    example: 'refund_1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund cancelled successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - refund not found or cannot be cancelled',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async cancelRefund(
    @Param('refundId') refundId: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ): Promise<RefundResponseDto> {
    // TODO: Add role-based guard for support/admin
    // @UseGuards(RolesGuard)
    // @Roles('support', 'admin')

    if (!body.reason) {
      throw new BadRequestException('Cancellation reason is required');
    }

    this.logger.log(`Cancelling refund ${refundId}`);
    return await this.refundsService.cancelRefund(
      refundId,
      body.reason,
      req.user?.id || 'system',
    );
  }

  @Get(':refundId')
  @ApiOperation({
    summary: 'Get refund by ID',
    description: 'Get refund details by ID',
  })
  @ApiParam({
    name: 'refundId',
    description: 'Refund ID',
    example: 'refund_1234567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund details retrieved successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Refund not found',
  })
  async getRefundById(
    @Param('refundId') refundId: string,
  ): Promise<RefundResponseDto> {
    return await this.refundsService.getRefundById(refundId);
  }

  @Get('payment/:paymentId')
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
