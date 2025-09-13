import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PublicCartService } from './public-cart.service';
import { CartItemQueryDto } from './dto/public-cart-query.dto';
import {
  AddToCartDto,
  UpdateCartItemDto,
  RemoveFromCartDto,
} from './dto/add-to-cart.dto';
import {
  CartResponseDto,
  PaginatedCartResponseDto,
} from './dto/public-cart-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../users/users.decorator';
import { JwtPayload } from '../../auth/jwt-payload';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth()
@ApiTags('Public Cart')
@Controller('public/cart')
@UseGuards(JwtAuthGuard)
export class PublicCartController {
  constructor(private readonly publicCartService: PublicCartService) {}

  /**
   * Add item to cart
   * POST /public/cart/add
   */
  @Post('add')
  @HttpCode(HttpStatus.OK)
  async addToCart(
    @CurrentUser() user: JwtPayload,
    @Body() addToCartDto: AddToCartDto,
  ): Promise<CartResponseDto> {
    const userId = user.id;
    return this.publicCartService.addToCart(userId, addToCartDto);
  }

  /**
   * Update cart item quantity
   * PUT /public/cart/update
   */
  @Put('update')
  @HttpCode(HttpStatus.OK)
  async updateCartItem(
    @CurrentUser() user: JwtPayload,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    const userId = user.id;
    return this.publicCartService.updateCartItem(userId, updateCartItemDto);
  }

  /**
   * Remove item from cart
   * DELETE /public/cart/remove
   */
  @Delete('remove')
  @HttpCode(HttpStatus.OK)
  async removeFromCart(
    @CurrentUser() user: JwtPayload,
    @Body() removeFromCartDto: RemoveFromCartDto,
  ): Promise<CartResponseDto> {
    const userId = user.id;
    return this.publicCartService.removeFromCart(userId, removeFromCartDto);
  }

  /**
   * Get user's cart with pagination and filtering
   * GET /public/cart
   */
  @Get()
  async getCart(
    @CurrentUser() user: JwtPayload,
    @Query() query: CartItemQueryDto,
  ): Promise<PaginatedCartResponseDto> {
    const userId = user.id;
    return this.publicCartService.getCart(userId, query);
  }

  /**
   * Get total count of items in user's cart
   * GET /public/cart/count
   */
  @Get('count')
  async getCartCount(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ totalItems: number; totalQuantity: number }> {
    const userId = user.id;
    return this.publicCartService.getCartCount(userId);
  }
}
