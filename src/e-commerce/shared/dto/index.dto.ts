import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PersonContactDto {
  @ApiProperty({
    description: 'Họ tên đầy đủ',
    example: 'Nguyễn Văn A',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0901234567',
  })
  @Transform(({ value }) => value?.trim())
  @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @ApiPropertyOptional({
    description: 'Email (tùy chọn)',
    example: 'nguyenvana@example.com',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;
}

export class AddressDto {
  @ApiProperty({
    description: 'Địa chỉ dòng 1',
    example: '123 Đường ABC',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  addressLine1: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ dòng 2',
    example: 'Tầng 2, Phòng 201',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  addressLine2?: string;

  @ApiProperty({
    description: 'Tỉnh/Thành phố',
    example: 'Hà Nội',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'Tỉnh/Thành phố không được để trống' })
  province: string;

  @ApiProperty({
    description: 'Quận/Huyện',
    example: 'Ba Đình',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'Quận/Huyện không được để trống' })
  district: string;

  @ApiProperty({
    description: 'Phường/Xã',
    example: 'Phúc Xá',
  })
  @Transform(({ value }) => value?.trim())
  @IsString()
  @IsNotEmpty({ message: 'Phường/Xã không được để trống' })
  ward: string;

  @ApiPropertyOptional({
    description: 'Mã bưu điện',
    example: '10000',
  })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  postalCode?: string;
}

export class VatInvoiceInfoDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã số thuế không được để trống' })
  taxCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên công ty không được để trống' })
  companyName: string;

  @IsOptional()
  @IsString()
  companyAddress?: string;

  @IsEmail({}, { message: 'Email nhận hóa đơn không hợp lệ' })
  @IsNotEmpty({ message: 'Email nhận hóa đơn không được để trống' })
  recipientEmail: string;
}

// Prisma chưa có enum cho OrderDelivery.type (Int?)
// 1 = Ship COD, 2 = Nhận tại kho (theo order.prisma)
export enum DeliveryType {
  ShipCOD = 1,
  PickupAtWarehouse = 2,
}
