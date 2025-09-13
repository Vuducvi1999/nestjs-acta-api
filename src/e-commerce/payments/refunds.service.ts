import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CreateRefundDto,
  ApproveRefundDto,
  SettleRefundDto,
  RefundResponseDto,
  RefundableAmountResponseDto,
  RefundItemDto,
} from './dto/refund.dto';
import {
  PaymentProcessingStatus,
  RefundStatus,
  TransactionType,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a refund request
   */
  async createRefund(
    dto: CreateRefundDto,
    userId: string,
  ): Promise<RefundResponseDto> {
    this.logger.log(
      `Creating refund request for payment ${dto.paymentId} by user ${userId}`,
    );

    return await this.prisma.$transaction(async (tx) => {
      // Load payment with order
      const payment = await tx.payment.findFirst({
        where: {
          id: dto.paymentId,
          status: PaymentProcessingStatus.succeeded,
        },
        include: {
          orderPayment: {
            include: {
              order: true,
            },
          },
          refunds: {
            where: {
              status: {
                in: [RefundStatus.succeeded, RefundStatus.processing],
              },
            },
          },
        },
      });

      if (!payment) {
        throw new BadRequestException(
          `Payment ${dto.paymentId} not found or not in succeeded status`,
        );
      }

      // Calculate refundable amount
      const originalAmount = Number(payment.amount);
      const refundedAmount = payment.refunds.reduce(
        (sum, refund) => sum + Number(refund.amount),
        0,
      );
      const refundableAmount = originalAmount - refundedAmount;

      if (dto.amount > refundableAmount) {
        throw new BadRequestException(
          `Refund amount ${dto.amount} exceeds refundable amount ${refundableAmount}`,
        );
      }

      if (dto.amount <= 0) {
        throw new BadRequestException('Refund amount must be greater than 0');
      }

      // Generate refund reference
      const refundReference = this.generateRefundReference();

      // Create refund record
      const refund = await tx.paymentRefund.create({
        data: {
          paymentId: dto.paymentId,
          amount: dto.amount,
          status: RefundStatus.requested,
          reason: dto.reason,
          reference: refundReference,
          requestedById: userId,
          requestMeta: JSON.stringify({
            items: dto.items || [],
            originalAmount,
            refundedAmount,
            refundableAmount,
            createdAt: new Date().toISOString(),
          }),
        },
      });

      // Create transaction record
      await tx.paymentTransaction.create({
        data: {
          paymentId: dto.paymentId,
          type: TransactionType.refund,
          amount: dto.amount,
          currency: payment.currency,
          meta: JSON.stringify({
            refundId: refund.id,
            status: RefundStatus.requested,
            reason: dto.reason,
            items: dto.items || [],
          }),
        },
      });

      // Update order if this is the first refund request
      if (refundedAmount === 0) {
        await tx.order.update({
          where: { id: payment.orderPayment?.orderId },
          data: {
            refundRequestedAt: new Date(),
          },
        });
      }

      this.logger.log(
        `Refund request created: ${refund.id} for payment ${dto.paymentId}, amount: ${dto.amount}`,
      );

      return this.mapRefundToResponseDto(refund, payment.orderPayment?.orderId);
    });
  }

  /**
   * Approve a refund request
   */
  async approveRefund(
    refundId: string,
    dto: ApproveRefundDto,
    userId: string,
  ): Promise<RefundResponseDto> {
    this.logger.log(`Approving refund ${refundId} by user ${userId}`);

    return await this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.findUnique({
        where: { id: refundId },
        include: {
          payment: {
            include: {
              orderPayment: {
                include: {
                  order: true,
                },
              },
            },
          },
        },
      });

      if (!refund) {
        throw new BadRequestException(`Refund ${refundId} not found`);
      }

      if (refund.status !== RefundStatus.requested) {
        throw new BadRequestException(
          `Refund ${refundId} is not in requested status (current: ${refund.status})`,
        );
      }

      // Update refund status
      const updatedRefund = await tx.paymentRefund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.approved,
          approvedById: userId,
          responseMeta: {
            ...((refund.responseMeta as any) || {}),
            approvedAt: new Date().toISOString(),
            approvedBy: userId,
            note: dto.note,
          },
        },
      });

      // Update transaction record
      await tx.paymentTransaction.updateMany({
        where: {
          paymentId: refund.paymentId,
          type: TransactionType.refund,
          meta: {
            path: ['refundId'],
            equals: refundId,
          },
        },
        data: {
          meta: {
            status: RefundStatus.approved,
            approvedAt: new Date().toISOString(),
            approvedBy: userId,
            note: dto.note,
          },
        },
      });

      this.logger.log(`Refund ${refundId} approved by user ${userId}`);

      return this.mapRefundToResponseDto(
        updatedRefund,
        refund.payment.orderPayment?.orderId,
      );
    });
  }

  /**
   * Settle a refund (attach bank proof and mark as succeeded)
   */
  async settleRefund(
    refundId: string,
    dto: SettleRefundDto,
    userId: string,
  ): Promise<RefundResponseDto> {
    this.logger.log(`Settling refund ${refundId} by user ${userId}`);

    return await this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.findUnique({
        where: { id: refundId },
        include: {
          payment: {
            include: {
              orderPayment: {
                include: {
                  order: true,
                },
              },
              refunds: {
                where: {
                  status: RefundStatus.succeeded,
                },
              },
            },
          },
        },
      });

      if (!refund) {
        throw new BadRequestException(`Refund ${refundId} not found`);
      }

      if (
        ![
          RefundStatus.approved,
          RefundStatus.processing,
          RefundStatus.cancelled,
          RefundStatus.failed,
          RefundStatus.succeeded,
          RefundStatus.requested,
        ].includes(refund.status)
      ) {
        throw new BadRequestException(
          `Refund ${refundId} is not in approved or processing status (current: ${refund.status})`,
        );
      }

      const settledAt = dto.settledAt || new Date();

      // Update refund status
      const updatedRefund = await tx.paymentRefund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.succeeded,
          providerRef: dto.providerRef,
          processedAt: settledAt,
          responseMeta: {
            ...((refund.responseMeta as any) || {}),
            settledAt: settledAt.toISOString(),
            settledBy: userId,
            providerRef: dto.providerRef,
          },
        },
      });

      // Update transaction record
      await tx.paymentTransaction.updateMany({
        where: {
          paymentId: refund.paymentId,
          type: TransactionType.refund,
          meta: {
            path: ['refundId'],
            equals: refundId,
          },
        },
        data: {
          providerRef: dto.providerRef,
          meta: {
            status: RefundStatus.succeeded,
            settledAt: settledAt.toISOString(),
            settledBy: userId,
            providerRef: dto.providerRef,
          },
        },
      });

      // Check if this is a full refund
      const originalAmount = Number(refund.payment.amount);
      const totalRefundedAmount =
        refund.payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0) +
        Number(refund.amount);

      const isFullRefund = totalRefundedAmount >= originalAmount;

      // Update payment status if full refund
      if (isFullRefund) {
        await tx.payment.update({
          where: { id: refund.paymentId },
          data: {
            status: PaymentProcessingStatus.refunded,
            refundedAt: settledAt,
          },
        });

        // Update order payment status
        await tx.orderPayment.updateMany({
          where: {
            payment: {
              id: refund.paymentId,
            },
          },
          data: {
            status: PaymentStatus.refunded,
          },
        });
      }

      // Update order status based on refund type and shipping status
      const order = refund.payment.orderPayment?.order;
      if (order) {
        if (isFullRefund) {
          // Check if order has been shipped
          const hasBeenShipped = [
            OrderStatus.delivering,
            OrderStatus.shipped,
            OrderStatus.completed,
            OrderStatus.draft,
            OrderStatus.confirmed,
            OrderStatus.cancelled,
            OrderStatus.refunded,
          ].includes(order.status);

          if (hasBeenShipped) {
            // Order has been shipped, mark as refunded (for return flow)
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.refunded,
                refundedAt: settledAt,
              },
            });
          } else {
            // Order not shipped, cancel it
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: OrderStatus.cancelled,
                cancelledAt: settledAt,
                adminNote: `Đơn hàng bị hủy do hoàn tiền toàn bộ (${settledAt.toISOString()})`,
              },
            });
          }
        } else {
          // Partial refund - keep order status but track refund
          await tx.order.update({
            where: { id: order.id },
            data: {
              refundedAt: settledAt,
            },
          });
        }
      }

      this.logger.log(
        `Refund ${refundId} settled successfully. Full refund: ${isFullRefund}`,
      );

      return this.mapRefundToResponseDto(
        updatedRefund,
        refund.payment.orderPayment?.orderId,
      );
    });
  }

  /**
   * Get refundable amount for a payment
   */
  async getRefundableAmount(
    paymentId: string,
  ): Promise<RefundableAmountResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        status: PaymentProcessingStatus.succeeded,
      },
      include: {
        refunds: {
          where: {
            status: {
              in: [RefundStatus.succeeded, RefundStatus.processing],
            },
          },
        },
      },
    });

    if (!payment) {
      throw new BadRequestException(
        `Payment ${paymentId} not found or not in succeeded status`,
      );
    }

    const originalAmount = Number(payment.amount);
    const refundedAmount = payment.refunds.reduce(
      (sum, refund) => sum + Number(refund.amount),
      0,
    );
    const refundableAmount = originalAmount - refundedAmount;

    return {
      paymentId,
      originalAmount,
      refundedAmount,
      refundableAmount,
      currency: payment.currency,
      paymentStatus: payment.status,
    };
  }

  /**
   * Get refunds for a payment
   */
  async getRefundsForPayment(paymentId: string): Promise<RefundResponseDto[]> {
    const refunds = await this.prisma.paymentRefund.findMany({
      where: { paymentId },
      include: {
        payment: {
          include: {
            orderPayment: {
              include: {
                order: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return refunds.map((refund) =>
      this.mapRefundToResponseDto(refund, refund.payment.orderPayment?.orderId),
    );
  }

  /**
   * Get refund by ID
   */
  async getRefundById(refundId: string): Promise<RefundResponseDto> {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          include: {
            orderPayment: {
              include: {
                order: true,
              },
            },
          },
        },
      },
    });

    if (!refund) {
      throw new BadRequestException(`Refund ${refundId} not found`);
    }

    return this.mapRefundToResponseDto(
      refund,
      refund.payment.orderPayment?.orderId,
    );
  }

  /**
   * Cancel a refund request
   */
  async cancelRefund(
    refundId: string,
    reason: string,
    userId: string,
  ): Promise<RefundResponseDto> {
    this.logger.log(`Cancelling refund ${refundId} by user ${userId}`);

    return await this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.findUnique({
        where: { id: refundId },
        include: {
          payment: {
            include: {
              orderPayment: {
                include: {
                  order: true,
                },
              },
            },
          },
        },
      });

      if (!refund) {
        throw new BadRequestException(`Refund ${refundId} not found`);
      }

      if (
        ![
          RefundStatus.requested,
          RefundStatus.approved,
          RefundStatus.cancelled,
          RefundStatus.processing,
          RefundStatus.succeeded,
          RefundStatus.failed,
        ].includes(refund.status)
      ) {
        throw new BadRequestException(
          `Refund ${refundId} cannot be cancelled (current status: ${refund.status})`,
        );
      }

      // Update refund status
      const updatedRefund = await tx.paymentRefund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.cancelled,
          responseMeta: {
            ...((refund.responseMeta as any) || {}),
            cancelledAt: new Date().toISOString(),
            cancelledBy: userId,
            cancelReason: reason,
          },
        },
      });

      // Update transaction record
      await tx.paymentTransaction.updateMany({
        where: {
          paymentId: refund.paymentId,
          type: TransactionType.refund,
          meta: {
            path: ['refundId'],
            equals: refundId,
          },
        },
        data: {
          meta: {
            status: RefundStatus.cancelled,
            cancelledAt: new Date().toISOString(),
            cancelledBy: userId,
            cancelReason: reason,
          },
        },
      });

      this.logger.log(`Refund ${refundId} cancelled by user ${userId}`);

      return this.mapRefundToResponseDto(
        updatedRefund,
        refund.payment.orderPayment?.orderId,
      );
    });
  }

  /**
   * Map refund to response DTO
   */
  private mapRefundToResponseDto(
    refund: any,
    orderId?: string,
  ): RefundResponseDto {
    return {
      refundId: refund.id,
      paymentId: refund.paymentId,
      orderId: orderId || '',
      amount: Number(refund.amount),
      status: refund.status,
      reason: refund.reason,
      providerRef: refund.providerRef,
      reference: refund.reference,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      processedAt: refund.processedAt,
      requestedById: refund.requestedById,
      approvedById: refund.approvedById,
    };
  }

  /**
   * Generate refund reference code
   */
  private generateRefundReference(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `REF-${timestamp}-${random}`;
  }
}
