import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType, OriginSource } from '@prisma/client';

export class CreateBusinessDto {
  @ApiProperty({
    description: 'ID của user sở hữu business',
    example: 'clx1234567890abcdef',
  })
  @IsString()
  @MinLength(1)
  userId: string;

  @ApiProperty({
    description: 'Tên doanh nghiệp',
    example: 'Công ty TNHH ABC',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Mô tả doanh nghiệp',
    example: 'Công ty chuyên về công nghệ thông tin',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Khẩu hiệu của doanh nghiệp',
    example: 'Innovation for tomorrow',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(255)
  slogan?: string;

  @ApiPropertyOptional({
    description: 'Logo của doanh nghiệp (URL)',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUrl()
  logo?: string;

  @ApiPropertyOptional({
    description: 'Banner của doanh nghiệp (URL)',
    example: 'https://example.com/banner.jpg',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUrl()
  banner?: string;

  @ApiPropertyOptional({
    description: 'Ảnh đại diện của doanh nghiệp (URL)',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUrl()
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Loại doanh nghiệp',
    enum: BusinessType,
    default: BusinessType.expansion,
  })
  @IsOptional()
  @IsEnum(BusinessType)
  type?: BusinessType;

  @ApiPropertyOptional({
    description: 'Mã số thuế',
    example: '0123456789',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @Matches(/^[0-9]{10,13}$/, {
    message: 'Mã số thuế phải có 10-13 chữ số',
  })
  taxCode?: string;

  @ApiProperty({
    description: 'Email liên hệ',
    example: 'contact@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Số điện thoại liên hệ',
    example: '+84123456789',
  })
  @IsPhoneNumber('VN')
  phone: string;

  @ApiPropertyOptional({
    description: 'Website của doanh nghiệp',
    example: 'https://example.com',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ doanh nghiệp',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: 'Vị trí địa lý',
    example: '10.762622,106.660172',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({
    description: 'Link Facebook',
    example: 'https://facebook.com/example',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUrl()
  facebook?: string;

  @ApiPropertyOptional({
    description: 'Link Instagram',
    example: 'https://instagram.com/example',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUrl()
  instagram?: string;

  @ApiPropertyOptional({
    description: 'Nguồn gốc của business',
    enum: OriginSource,
    default: OriginSource.acta,
  })
  @IsOptional()
  @IsEnum(OriginSource)
  source?: OriginSource;

  @ApiPropertyOptional({
    description: 'Trạng thái xác minh',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // KiotViet integration fields (optional)
  @ApiPropertyOptional({
    description: 'ID đối tác từ KiotViet',
    example: 12345,
  })
  @IsOptional()
  kiotVietTradeMarkId?: number;

  @ApiPropertyOptional({
    description: 'Mã đối tác',
    example: 'PARTNER001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;
}
