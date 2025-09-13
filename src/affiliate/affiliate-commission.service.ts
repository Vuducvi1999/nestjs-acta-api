import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateAffiliateCommissionDto } from './dto/create-commission.dto';
import { UpdateAffiliateCommissionDto } from './dto/update-commission.dto';
import { CalculateCommissionDto } from './dto/calculate-commission.dto';
import { CommissionQueryDto } from './dto/commission-query.dto';
import { AffiliateCommissionResponseDto } from './dto/commission-response.dto';
import { CommissionLevel, CommissionStatus } from '@prisma/client';
import {
  CategoryGroup,
  OrderStatus,
  CalculationStatus,
  COMMISSION_RATES,
  CommissionWhereClause,
  CommissionInclude,
  CommissionSummary,
  CommissionCalculationResult,
  CommissionStats,
  CommissionLevelStats,
  SalesData,
  UserCommissionResponse,
  PaginatedCommissionResponse,
  CommissionLogData,
  CommissionCreateData,
  OrderItem,
  isCategoryGroup,
  isOrderStatus,
} from './types/commission.types';

@Injectable()
export class AffiliateCommissionService {
  private readonly logger = new Logger(AffiliateCommissionService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    createDto: CreateAffiliateCommissionDto,
  ): Promise<AffiliateCommissionResponseDto> {
    const commission = await this.prisma.affiliateCommission.create({
      data: createDto,
      include: {
        beneficiary: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        order: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return {
      ...commission,
      commissionRate: Number(commission.commissionRate),
      baseAmount: Number(commission.baseAmount),
      commissionAmount: Number(commission.commissionAmount),
      product: {
        ...commission.product,
        price: Number(commission.product.price),
      },
    } as AffiliateCommissionResponseDto;
  }

  async findAll(
    query: CommissionQueryDto,
  ): Promise<PaginatedCommissionResponse> {
    this.logger.log('Getting all commissions with filters');

    const { page = 1, limit = 10, ...filters } = query;
    const skip = (page - 1) * limit;

    const where = this.buildCommissionWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          beneficiary: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              group: true,
            },
          },
          order: {
            select: {
              id: true,
              code: true,
              status: true,
              purchaseDate: true,
            },
          },
        },
      }),
      this.prisma.affiliateCommission.count({ where }),
    ]);

    return {
      data: this.transformCommissionRows(data),
      total,
      page,
      limit,
    };
  }

  private buildCommissionWhereClause(
    filters: Partial<CommissionQueryDto>,
  ): CommissionWhereClause {
    const where: CommissionWhereClause = {};

    if (filters.orderId) where.orderId = filters.orderId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.beneficiaryId) where.beneficiaryId = filters.beneficiaryId;
    if (filters.commissionLevel)
      where.commissionLevel = filters.commissionLevel;
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return where;
  }

  async findOne(id: string): Promise<AffiliateCommissionResponseDto> {
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id },
      include: {
        beneficiary: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        order: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    if (!commission) {
      throw new NotFoundException(
        `Affiliate commission with ID ${id} not found`,
      );
    }

    return {
      ...commission,
      commissionRate: Number(commission.commissionRate),
      baseAmount: Number(commission.baseAmount),
      commissionAmount: Number(commission.commissionAmount),
      product: {
        ...commission.product,
        price: Number(commission.product.price),
      },
    } as AffiliateCommissionResponseDto;
  }

  async update(
    id: string,
    updateDto: UpdateAffiliateCommissionDto,
  ): Promise<AffiliateCommissionResponseDto> {
    const commission = await this.prisma.affiliateCommission.update({
      where: { id },
      data: updateDto,
      include: {
        beneficiary: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        order: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return {
      ...commission,
      commissionRate: Number(commission.commissionRate),
      baseAmount: Number(commission.baseAmount),
      commissionAmount: Number(commission.commissionAmount),
      product: {
        ...commission.product,
        price: Number(commission.product.price),
      },
    } as AffiliateCommissionResponseDto;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.affiliateCommission.delete({
      where: { id },
    });
  }

  async calculateCommissions(
    calculateDto: CalculateCommissionDto,
  ): Promise<CommissionCalculationResult> {
    const { orderId, processedBy, notes } = calculateDto;

    this.logger.log(`Calculating commissions for order: ${orderId}`);

    try {
      // Kiểm tra đơn hàng tồn tại và đã hoàn thành
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderDetails: {
            include: {
              product: {
                include: {
                  category: true,
                },
              },
            },
          },
          customer: {
            include: {
              user: {
                include: {
                  referrer: {
                    include: {
                      referrer: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (
        !isOrderStatus(order.status) ||
        order.status !== OrderStatus.COMPLETED
      ) {
        throw new BadRequestException(
          `Order must be completed to calculate commissions. Current status: ${order.status}`,
        );
      }

      // Xóa các commission cũ nếu có
      await this.prisma.affiliateCommission.deleteMany({
        where: { orderId },
      });

      const commissions: CommissionCreateData[] = [];
      let totalAmount = 0;

      // Tính commission cho từng sản phẩm trong đơn hàng
      for (const orderDetail of order.orderDetails) {
        const { product, quantity } = orderDetail;
        const category = product.category;

        // Xác định tỷ lệ hoa hồng dựa trên nhóm ngành
        const categoryGroup = isCategoryGroup(category.group)
          ? category.group
          : CategoryGroup.A;

        const categoryCommissionRate = COMMISSION_RATES.CATEGORY[categoryGroup];
        const baseAmount = Number(product.price) * quantity;
        const totalCommissionAmount = baseAmount * categoryCommissionRate;

        // Tìm orderDetail tương ứng
        const orderDetailRecord = order.orderDetails.find(
          (detail) => detail.productId === product.id,
        );

        // Tạo commission cho F2 (người mua hàng)
        if (order.customer.user) {
          const f2Commission: CommissionCreateData = {
            orderId,
            orderDetailId: orderDetailRecord?.id,
            productId: product.id,
            beneficiaryId: order.customer.user.id,
            commissionLevel: CommissionLevel.F2,
            commissionRate: categoryCommissionRate,
            baseAmount,
            quantity,
            commissionAmount: totalCommissionAmount,
            categoryId: category.id,
            status: CommissionStatus.calculated,
          };
          commissions.push(f2Commission);
          totalAmount += totalCommissionAmount;

          // Tạo commission cho F1 (người giới thiệu trực tiếp)
          if (order.customer.user.referrer) {
            const f1Rate = COMMISSION_RATES.LEVEL[CommissionLevel.F1];
            const f1Commission: CommissionCreateData = {
              orderId,
              orderDetailId: orderDetailRecord?.id,
              productId: product.id,
              beneficiaryId: order.customer.user.referrer.id,
              commissionLevel: CommissionLevel.F1,
              commissionRate: f1Rate,
              baseAmount,
              quantity,
              commissionAmount: baseAmount * f1Rate,
              categoryId: category.id,
              status: CommissionStatus.calculated,
            };
            commissions.push(f1Commission);
            totalAmount += baseAmount * f1Rate;

            // Tạo commission cho F0 (người giới thiệu gián tiếp)
            if (order.customer.user.referrer.referrer) {
              const f0Rate = COMMISSION_RATES.LEVEL[CommissionLevel.F0];
              const f0Commission: CommissionCreateData = {
                orderId,
                orderDetailId: orderDetailRecord?.id,
                productId: product.id,
                beneficiaryId: order.customer.user.referrer.referrer.id,
                commissionLevel: CommissionLevel.F0,
                commissionRate: f0Rate,
                baseAmount,
                quantity,
                commissionAmount: baseAmount * f0Rate,
                categoryId: category.id,
                status: CommissionStatus.calculated,
              };
              commissions.push(f0Commission);
              totalAmount += baseAmount * f0Rate;
            }
          }
        }
      }

      // Lưu tất cả commissions vào database
      if (commissions.length > 0) {
        await this.prisma.affiliateCommission.createMany({
          data: commissions,
        });
      }

      // Tạo log
      const logData: CommissionLogData = {
        orderId,
        totalCommissionAmount: totalAmount,
        commissionCount: commissions.length,
        calculationStatus: CalculationStatus.SUCCESS,
        processedBy: processedBy || '',
        notes: notes || '',
      };

      await this.prisma.affiliateCommissionLog.create({
        data: logData,
      });

      this.logger.log(
        `Successfully calculated ${commissions.length} commissions for order ${orderId}`,
      );

      return {
        success: true,
        message: `Successfully calculated ${commissions.length} commissions`,
        totalCommissions: commissions.length,
        totalAmount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to calculate commissions for order ${orderId}:`,
        error,
      );

      // Log the error
      const errorLogData: CommissionLogData = {
        orderId,
        totalCommissionAmount: 0,
        commissionCount: 0,
        calculationStatus: CalculationStatus.FAILED,
        processedBy: processedBy || '',
        notes: `Error: ${error.message}`,
      };

      await this.prisma.affiliateCommissionLog.create({
        data: errorLogData,
      });

      return {
        success: false,
        message: `Failed to calculate commissions: ${error.message}`,
        totalCommissions: 0,
        totalAmount: 0,
        errors: [error.message],
      };
    }
  }

  async markAsPaid(
    id: string,
    paidBy: string,
  ): Promise<AffiliateCommissionResponseDto> {
    const commission = await this.prisma.affiliateCommission.update({
      where: { id },
      data: {
        status: CommissionStatus.paid,
        paidAt: new Date(),
        paidBy,
      },
      include: {
        beneficiary: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            group: true,
          },
        },
        order: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
      },
    });

    return {
      ...commission,
      commissionRate: Number(commission.commissionRate),
      baseAmount: Number(commission.baseAmount),
      commissionAmount: Number(commission.commissionAmount),
      product: {
        ...commission.product,
        price: Number(commission.product.price),
      },
    } as AffiliateCommissionResponseDto;
  }

  async getUserCommissions(
    userId: string,
    query: CommissionQueryDto,
  ): Promise<{
    data: any[];
    total: number;
    summary: CommissionSummary;
  }> {
    this.logger.log(`Getting commissions for user: ${userId}`);

    const {
      page,
      limit,
      startDate,
      endDate,
      includeOrders,
      orderLimit = 5,
      commissionLevel,
      status,
    } = query;

    // Build where clause for commissions
    const commissionWhere: any = { beneficiaryId: userId };
    if (commissionLevel) commissionWhere.commissionLevel = commissionLevel;
    if (status) commissionWhere.status = status;
    if (startDate || endDate) {
      commissionWhere.createdAt = {};
      if (startDate) commissionWhere.createdAt.gte = new Date(startDate);
      if (endDate) commissionWhere.createdAt.lte = new Date(endDate);
    }

    const pagination = this.buildPaginationOptions(page, limit);

    // Lấy commissions với orderDetail để có giá chính xác tại thời điểm mua
    const [commissions, total] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where: commissionWhere,
        orderBy: { createdAt: 'desc' },
        ...pagination,
        select: {
          id: true,
          commissionLevel: true,
          commissionAmount: true,
          status: true,
          createdAt: true,
          orderDetail: {
            select: {
              quantity: true,
              price: true, // Giá tại thời điểm mua hàng
            },
          },
        },
      }),
      this.prisma.affiliateCommission.count({ where: commissionWhere }),
    ]);

    // Tính summary dựa trên commissions đã có, không cần query phức tạp
    const summary = this.buildSimplifiedSummary(commissions);

    if (includeOrders) {
      summary.ordersByLevel = await this.getOrdersByLevelSimplified(
        commissionWhere,
        orderLimit,
      );
    }

    return {
      data: this.transformCommissionRows(commissions),
      total,
      summary,
    };
  }

  private buildSimplifiedSummary(commissions: any[]): CommissionSummary {
    const summary: CommissionSummary = {
      totalEarned: 0,
      totalPaid: 0,
      totalPending: 0,
      totalSales: 0,
      byLevel: {},
      salesByLevel: {},
    };

    for (const commission of commissions) {
      const commissionAmount = Number(commission.commissionAmount);
      const level = commission.commissionLevel as CommissionLevel;

      // Tổng thu nhập
      summary.totalEarned += commissionAmount;

      // Theo status
      if (commission.status === CommissionStatus.paid) {
        summary.totalPaid += commissionAmount;
      } else if (commission.status === CommissionStatus.calculated) {
        summary.totalPending += commissionAmount;
      }

      // Theo level - commission amount
      if (!summary.byLevel[level]) {
        summary.byLevel[level] = 0;
      }
      summary.byLevel[level] += commissionAmount;

      // Theo level - sales amount (quantity * price từ orderDetail)
      if (!summary.salesByLevel) summary.salesByLevel = {};
      if (!summary.salesByLevel[level]) {
        summary.salesByLevel[level] = 0;
      }

      // Tính doanh số thực tế từ orderDetail.quantity * orderDetail.price
      if (commission.orderDetail) {
        const actualSales =
          Number(commission.orderDetail.quantity) *
          Number(commission.orderDetail.price);

        summary.salesByLevel[level] += actualSales;
        summary.totalSales += actualSales;
      }
      // Không cần fallback vì orderDetail luôn có với commission mới
    }

    return summary;
  }

  private async getOrdersByLevelSimplified(
    commissionWhere: any,
    orderLimit: number,
  ): Promise<Partial<Record<CommissionLevel, any[]>>> {
    const levels: CommissionLevel[] = [
      CommissionLevel.F2,
      CommissionLevel.F1,
      CommissionLevel.F0,
    ];

    const ordersByLevel: Partial<Record<CommissionLevel, any[]>> = {};

    // Parallel queries cho mỗi level
    await Promise.all(
      levels.map(async (level) => {
        const items = await this.prisma.affiliateCommission.findMany({
          where: { ...commissionWhere, commissionLevel: level },
          orderBy: { createdAt: 'desc' },
          take: Number(orderLimit) || 5,
          include: {
            order: {
              select: {
                id: true,
                code: true,
                purchaseDate: true,
                orderDetails: {
                  select: {
                    quantity: true,
                    price: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                        category: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
                customer: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        fullName: true,
                        referrer: {
                          select: {
                            id: true,
                            fullName: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          distinct: ['orderId'], // Chỉ lấy unique orders
        });

        ordersByLevel[level] = items.map((item) => {
          const order = item.order;
          const totalOrderValue =
            order?.orderDetails?.reduce(
              (sum, detail) =>
                sum + Number(detail.quantity) * Number(detail.price),
              0,
            ) || 0;

          return {
            id: order?.code || item.orderId,
            date: order?.purchaseDate || new Date(),
            total: totalOrderValue,
            commission: Number(item.commissionAmount),
            referralName: order?.customer?.user?.fullName || 'N/A',
            f1Name: order?.customer?.user?.referrer?.fullName || 'N/A',
            products:
              order?.orderDetails?.map((detail) => ({
                name: detail.product?.name || 'Unknown Product',
                quantity: Number(detail.quantity),
                price: Number(detail.price),
                category: detail.product?.category?.name || 'Unknown',
              })) || [],
          };
        });
      }),
    );

    return ordersByLevel;
  }

  private buildPaginationOptions(page?: number, limit?: number) {
    const take = limit ? Number(limit) : undefined;
    const skip = page && limit ? (Number(page) - 1) * Number(limit) : undefined;
    return { take, skip };
  }

  private transformCommissionRows(rows: any[]): any[] {
    return rows.map((item) => ({
      id: item.id,
      commissionLevel: item.commissionLevel,
      commissionAmount: Number(item.commissionAmount),
      status: item.status,
      createdAt: item.createdAt,
      salesAmount: item.orderDetail
        ? Number(item.orderDetail.quantity) * Number(item.orderDetail.price)
        : 0,
    }));
  }
}
