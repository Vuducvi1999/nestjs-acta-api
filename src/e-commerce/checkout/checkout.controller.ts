import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../users/users.decorator';
import { JwtPayload } from '../../auth/jwt-payload';
import { CheckoutService } from './checkout.service';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import {
  OrderResponseDto,
  PublicOrderDetailResponseDto,
} from './dto/order-response.dto';
import { PrismaService } from '../../common/services/prisma.service';
import {
  buildPickupOptionsForCart,
  CartItemSlim,
} from './warehouse-pickup.helper';
import { PublicWarehousePickupListResponseDto } from './dto/public-warehouse-pickup.dto';

@ApiBearerAuth()
@ApiTags('Checkout')
@UseGuards(JwtAuthGuard)
@Controller('e-commerce/checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post('create-order')
  @ApiOperation({
    summary: 'Create order from cart',
    description: "Create a new order from the user's cart items",
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cart is empty or items unavailable',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createOrderFromCart(
    @CurrentUser() user: JwtPayload,
    @Body() createOrderDto: CreateOrderFromCartDto,
    @Body() rawBody: any,
  ): Promise<{
    success: boolean;
    data: OrderResponseDto;
    message?: string;
  }> {
    try {
      console.log('Raw request body:', rawBody);
      console.log('Transformed DTO:', createOrderDto);
      const order = await this.checkoutService.createOrderFromCart(
        user,
        createOrderDto,
      );
      return {
        success: true,
        data: order,
        message: 'Đơn hàng đã được tạo thành công',
      };
    } catch (error) {
      console.error('Error creating order:', error);
      throw error; // Let NestJS handle the error response
    }
  }

  @Get('orders/:orderId')
  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Get detailed information about a specific order',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details retrieved successfully',
    type: PublicOrderDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getOrderById(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
  ): Promise<{
    success: boolean;
    data: PublicOrderDetailResponseDto;
    message?: string;
  }> {
    try {
      const order = await this.checkoutService.getOrderById(user, orderId);
      return {
        success: true,
        data: order,
        message: 'Lấy thông tin đơn hàng thành công',
      };
    } catch (error) {
      console.error('Error getting order:', error);
      throw error; // Let NestJS handle the error response
    }
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Get user orders',
    description: 'Get paginated list of user orders',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/PublicOrderDetailResponseDto' },
        },
        totalItems: { type: 'number' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserOrders(
    @CurrentUser() user: JwtPayload,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ): Promise<{
    success: boolean;
    data: {
      orders: PublicOrderDetailResponseDto[];
      totalItems: number;
      page: number;
      totalPages: number;
    };
    message?: string;
  }> {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;

      const result = await this.checkoutService.getUserOrders(
        user,
        pageNum,
        limitNum,
      );
      return {
        success: true,
        data: result,
        message: 'Lấy danh sách đơn hàng thành công',
      };
    } catch (error) {
      console.error('Error getting user orders:', error);
      throw error; // Let NestJS handle the error response
    }
  }

  @Delete('orders/:orderId')
  @ApiOperation({
    summary: 'Cancel order',
    description:
      'Cancel a specific order (only draft or confirmed orders can be cancelled)',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: PublicOrderDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - order cannot be cancelled in current status',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async cancelOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body('reason') reason?: string,
  ): Promise<{
    success: boolean;
    data: PublicOrderDetailResponseDto;
    message?: string;
  }> {
    try {
      const order = await this.checkoutService.cancelOrder(
        user,
        orderId,
        reason,
      );
      return {
        success: true,
        data: order,
        message: 'Hủy đơn hàng thành công',
      };
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error; // Let NestJS handle the error response
    }
  }

  @Get('pickup-options')
  @ApiOperation({
    summary: 'Get warehouse pickup options for cart',
    description: 'Get all warehouses with availability summary for cart items',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse pickup options retrieved successfully',
    type: PublicWarehousePickupListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cartId is required',
  })
  @ApiResponse({
    status: 404,
    description: 'Cart not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getPickupOptions(
    @CurrentUser() user: JwtPayload,
    @Query('cartId') cartId: string,
    @Query('warehouseId') preselectedWarehouseId?: string,
  ): Promise<PublicWarehousePickupListResponseDto> {
    if (!cartId) throw new NotFoundException('cartId is required');

    const cart = await this.prismaService.cart.findUnique({
      where: { id: cartId },
      select: { id: true, userId: true },
    });
    if (!cart) throw new NotFoundException('Cart not found');

    // Security check: ensure user can only access their own cart
    if (cart.userId !== user.id) {
      throw new NotFoundException('Cart not found');
    }

    const items = await this.loadCartItemsSlim(cartId);

    // Check if cart has items
    if (items.length === 0) {
      return { options: [], chosenWarehouseId: preselectedWarehouseId };
    }

    return buildPickupOptionsForCart(
      this.prismaService,
      items,
      preselectedWarehouseId,
    );
  }

  private async loadCartItemsSlim(cartId: string): Promise<CartItemSlim[]> {
    const rows = await this.prismaService.cartItem.findMany({
      where: { cartId },
      select: {
        productId: true,
        quantity: true,
        product: {
          select: {
            slug: true,
            name: true,
            thumbnail: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      productId: r.productId,
      quantity: r.quantity,
      slug: r.product?.slug ?? undefined,
      name: r.product?.name ?? undefined,
      image: r.product?.thumbnail ?? undefined,
    }));
  }
}
