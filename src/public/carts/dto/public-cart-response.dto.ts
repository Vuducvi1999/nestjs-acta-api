import { PublicProductItemResponseDto } from '../../products/dto/public-product-response.dto';
import { PublicProductHelper } from '../../products/public-product.helper';

export class CartItemResponseDto {
  cartItemId: string;
  quantity: number;
  subtotal: number;

  product: PublicProductItemResponseDto; // <-- use your existing DTO here

  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<CartItemResponseDto>) {
    Object.assign(this, partial);
  }

  static fromCartItem(item: any): CartItemResponseDto {
    // Transform product using the helper function to ensure proper price formatting
    const transformedProduct =
      PublicProductHelper.transformProductForPublicResponse(item.product);

    return {
      cartItemId: item.id,
      quantity: item.quantity,
      subtotal: transformedProduct.price * item.quantity,
      product: PublicProductItemResponseDto.fromProduct(transformedProduct),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

export class CartResponseDto {
  id: string;
  userId: string;
  items: CartItemResponseDto[];
  totalQuantity: number;
  totalPrice: number;

  static fromCart(cart: any): CartResponseDto {
    const items = cart.items.map((i: any) =>
      CartItemResponseDto.fromCartItem(i),
    );
    return {
      id: cart.id,
      userId: cart.userId,
      items,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: items.reduce((sum, i) => sum + i.subtotal, 0),
    };
  }
}

/** Paginated cart (items are paginated; cart totals still reflect the WHOLE cart) */
export class PaginatedCartResponseDto {
  cartId: string;
  userId: string;

  // Page slice
  items: CartItemResponseDto[];
  totalItems: number; // total number of items across the whole cart
  page: number;
  totalPages: number;

  // Cart-level totals (for the WHOLE cart, not just the current page)
  totalQuantity: number;
  totalPrice: number;

  static fromPaginatedCart(result: {
    cart: { id: string; userId: string };
    // items in the CURRENT PAGE (array of CartItem with product populated)
    items: any[];
    // total numbers computed for the WHOLE cart (not only current page)
    wholeCartTotals: {
      totalQuantity: number;
      totalPrice: number;
      totalItems: number;
    };
    page: number;
    totalPages: number;
  }): PaginatedCartResponseDto {
    const pageItems = result.items.map((i) =>
      CartItemResponseDto.fromCartItem(i),
    );

    return {
      cartId: result.cart.id,
      userId: result.cart.userId,
      items: pageItems,
      totalItems: result.wholeCartTotals.totalItems,
      page: result.page,
      totalPages: result.totalPages,
      totalQuantity: result.wholeCartTotals.totalQuantity,
      totalPrice: result.wholeCartTotals.totalPrice,
    };
  }
}
