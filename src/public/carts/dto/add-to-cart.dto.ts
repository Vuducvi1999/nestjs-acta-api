import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNumber, IsString, Max, Min } from 'class-validator';

/**
 * DTO for adding items to cart
 * Follows the same pattern as other public DTOs
 */
export class AddToCartDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  @Max(999, { message: 'Số lượng không được vượt quá 999' })
  @Transform(({ value }) => {
    if (typeof value === 'string') return parseInt(value, 10);
    return value;
  })
  quantity: number;
}

/**
 * DTO for updating cart item quantity
 */
export class UpdateCartItemDto {
  @IsString()
  cartItemId: string;

  @IsNumber()
  @Min(1, { message: 'Số lượng phải lớn hơn 0' })
  @Max(999, { message: 'Số lượng không được vượt quá 999' })
  @Transform(({ value }) => {
    if (typeof value === 'string') return parseInt(value, 10);
    return value;
  })
  quantity: number;
}

/**
 * DTO for removing items from cart
 */
export class RemoveFromCartDto {
  @IsString()
  cartItemId: string;
}

export class ApplyVouchersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  codes: string[];
}

export class RemoveVoucherDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  codes: string[];
}