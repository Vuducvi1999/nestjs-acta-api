import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessType, OriginSource } from '@prisma/client';

export class BusinessResponseDto {
  @ApiProperty({
    description: 'ID của business',
    example: 'clx1234567890abcdef',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'ID đối tác từ KiotViet',
    example: 12345,
  })
  kiotVietTradeMarkId?: number | null;

  @ApiPropertyOptional({
    description: 'Mã đối tác',
    example: 'PARTNER001',
  })
  code?: string | null;

  @ApiProperty({
    description: 'Tên doanh nghiệp',
    example: 'Công ty TNHH ABC',
  })
  name: string;

  @ApiProperty({
    description: 'URL thân thiện',
    example: 'cong-ty-tnhh-abc',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'Mô tả doanh nghiệp',
    example: 'Công ty chuyên về công nghệ thông tin',
  })
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Khẩu hiệu của doanh nghiệp',
    example: 'Innovation for tomorrow',
  })
  slogan?: string | null;

  @ApiPropertyOptional({
    description: 'Logo của doanh nghiệp (URL)',
    example: 'https://example.com/logo.png',
  })
  logo?: string | null;

  @ApiPropertyOptional({
    description: 'Banner của doanh nghiệp (URL)',
    example: 'https://example.com/banner.jpg',
  })
  banner?: string | null;

  @ApiPropertyOptional({
    description: 'Ảnh đại diện của doanh nghiệp (URL)',
    example: 'https://example.com/avatar.jpg',
  })
  avatar?: string | null;

  @ApiProperty({
    description: 'Nguồn gốc của business',
    enum: OriginSource,
    example: OriginSource.acta,
  })
  source: OriginSource;

  @ApiProperty({
    description: 'Loại doanh nghiệp',
    enum: BusinessType,
    example: BusinessType.expansion,
  })
  type: BusinessType;

  @ApiPropertyOptional({
    description: 'Mã số thuế',
    example: '0123456789',
  })
  taxCode?: string | null;

  @ApiProperty({
    description: 'Email liên hệ',
    example: 'contact@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Số điện thoại liên hệ',
    example: '+84123456789',
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Website của doanh nghiệp',
    example: 'https://example.com',
  })
  website?: string | null;

  @ApiPropertyOptional({
    description: 'Địa chỉ doanh nghiệp',
    example: '123 Đường ABC, Quận 1, TP.HCM',
  })
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Vị trí địa lý',
    example: '10.762622,106.660172',
  })
  location?: string | null;

  @ApiPropertyOptional({
    description: 'Link Facebook',
    example: 'https://facebook.com/example',
  })
  facebook?: string | null;

  @ApiPropertyOptional({
    description: 'Link Instagram',
    example: 'https://instagram.com/example',
  })
  instagram?: string | null;

  @ApiProperty({
    description: 'Đánh giá trung bình',
    example: 4.5,
  })
  rating: number;

  @ApiProperty({
    description: 'Tổng số đánh giá',
    example: 100,
  })
  totalRatings: number;

  @ApiProperty({
    description: 'Số lượng sản phẩm',
    example: 50,
  })
  productCount: number;

  @ApiProperty({
    description: 'Số người theo dõi',
    example: 1000,
  })
  followers: number;

  @ApiProperty({
    description: 'Tỷ lệ phản hồi',
    example: 95.5,
  })
  responseRate: number;

  @ApiProperty({
    description: 'Thời gian phản hồi',
    example: '24h',
  })
  responseTime: string;

  @ApiProperty({
    description: 'Trạng thái xác minh',
    example: false,
  })
  verified: boolean;

  @ApiProperty({
    description: 'Trạng thái hoạt động',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Ngày tham gia',
    example: '2024-01-15T00:00:00.000Z',
  })
  joinDate: Date;

  @ApiProperty({
    description: 'ID của user sở hữu business',
    example: 'clx1234567890abcdef',
  })
  userId: string;

  @ApiProperty({
    description: 'Ngày tạo',
    example: '2024-01-15T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Ngày cập nhật',
    example: '2024-01-15T00:00:00.000Z',
  })
  updatedAt: Date;
}
