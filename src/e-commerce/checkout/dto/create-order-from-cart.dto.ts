import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
  ValidateNested,
  IsEnum,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider, PaymentMethod } from '@prisma/client';
import {
  AddressDto,
  DeliveryType,
  PersonContactDto,
  VatInvoiceInfoDto,
} from '../../shared/dto/index.dto';

export class CreateOrderFromCartDto {
  // ——— Idempotency ———
  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate order submissions',
    example: 'req_1234567890abcdef',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  clientRequestId?: string; // use as idempotency key

  // ——— General context ———
  @ApiPropertyOptional({
    description: 'ID của kênh bán hàng',
    example: 'channel_123',
  })
  @IsOptional()
  @IsString()
  saleChannelId?: string;

  @ApiPropertyOptional({
    description:
      'ID kho hàng (nếu không cung cấp, hệ thống sẽ tự động chọn kho tối ưu dựa trên tồn kho sản phẩm)',
    example: 'warehouse_456',
  })
  @IsOptional()
  @IsString()
  warehouseId?: string; // if omitted, backend selects optimal warehouse based on product inventories

  // ——— Delivery ———
  @ApiProperty({
    description: 'Phương thức giao hàng',
    enum: DeliveryType,
    example: DeliveryType.ShipCOD,
  })
  @IsEnum(DeliveryType)
  deliveryType: DeliveryType; // ShipCOD (1) | PickupAtWarehouse (2)

  @ApiPropertyOptional({
    description: 'Địa chỉ giao hàng (bắt buộc khi chọn giao hàng COD)',
    type: AddressDto,
  })
  @ValidateIf((o) => o.deliveryType === DeliveryType.ShipCOD)
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress?: AddressDto; // REQUIRED when ShipCOD

  @ApiPropertyOptional({
    description: 'ID kho nhận hàng (bắt buộc khi chọn nhận tại kho)',
    example: 'warehouse_789',
  })
  @ValidateIf((o) => o.deliveryType === DeliveryType.PickupAtWarehouse)
  @IsNotEmpty({ message: 'Yêu cầu kho nhận hàng khi chọn Nhận tại kho' })
  @IsString()
  pickupWarehouseId?: string; // If you want a separate field; or reuse warehouseId

  // ——— Contact ———
  @ApiProperty({
    description: 'Thông tin người nhận hàng',
    type: PersonContactDto,
  })
  @ValidateNested()
  @Type(() => PersonContactDto)
  receiver: PersonContactDto; // receiver snapshot

  @ApiPropertyOptional({
    description: 'Thông tin khách hàng (cho khách hàng không đăng nhập)',
    type: PersonContactDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonContactDto)
  guestContact?: PersonContactDto;

  @ApiPropertyOptional({
    description: 'Thời gian giao hàng theo lịch',
    example: '2024-01-15T12:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  // ——— VAT invoice (optional) ———
  @ApiPropertyOptional({
    description: 'Thông tin hóa đơn VAT (tùy chọn)',
    type: VatInvoiceInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => VatInvoiceInfoDto)
  vatInvoice?: VatInvoiceInfoDto;

  // ——— Payment ———
  @ApiProperty({
    description: 'Phương thức thanh toán',
    enum: PaymentMethod,
    example: PaymentMethod.transfer,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod; // must be 'transfer' for VietQR

  @ApiPropertyOptional({
    description:
      'Nhà cung cấp thanh toán (bắt buộc là vietqr cho chuyển khoản)',
    enum: ['vietqr'],
    example: 'vietqr',
  })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.transfer)
  @IsIn(['vietqr'], {
    message: 'paymentProvider phải là vietqr cho chuyển khoản',
  })
  paymentProvider?: 'vietqr';

  @ApiPropertyOptional({
    description: 'Idempotency key để tránh tạo payment trùng lặp',
    example: 'req_1234567890abcdef',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  // return/cancel are still useful for VNPay/Stripe; keep them optional
  @ApiPropertyOptional({
    description: 'URL chuyển hướng sau khi thanh toán thành công',
    example: 'https://example.com/payment-success',
  })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiPropertyOptional({
    description: 'URL chuyển hướng khi hủy thanh toán',
    example: 'https://example.com/payment-cancel',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;

  // ——— Promotions ———
  @ApiProperty({
    description: 'Danh sách mã voucher áp dụng',
    type: [String],
    example: ['VOUCHER10', 'FREESHIP'],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  voucherCodes: string[] = [];

  // ——— Notes ———
  @ApiPropertyOptional({
    description: 'Ghi chú đơn hàng',
    example: 'Giao hàng vào buổi chiều',
  })
  @IsOptional()
  @IsString()
  note?: string;

  // ——— Agreements ———
  @ApiProperty({
    description: 'Đồng ý với điều khoản và điều kiện',
    example: true,
  })
  @IsBoolean()
  agreedToTerms: boolean;
}
