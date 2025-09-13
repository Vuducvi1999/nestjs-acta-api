import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class ExternalCompletePaymentDto {
  @ApiProperty({ description: 'ID giao dịch trên SePay' })
  @IsNumber()
  @IsNotEmpty()
  id!: number;

  @ApiProperty({ description: 'Brand name của ngân hàng' })
  @IsString()
  @IsNotEmpty()
  gateway!: string;

  @ApiProperty({ description: 'Thời gian xảy ra giao dịch phía ngân hàng' })
  @IsString()
  @IsNotEmpty()
  transactionDate!: string;

  @ApiProperty({ description: 'Số tài khoản ngân hàng' })
  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @ApiProperty({
    description:
      'Mã code thanh toán (sepay tự nhận diện dựa vào cấu hình tại Cổng)',
    required: false,
  })
  @IsString()
  @IsOptional()
  code?: string | null;

  @ApiProperty({ description: 'Nội dung chuyển khoản' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({
    description: 'Loại giao dịch. in là tiền vào, out là tiền ra',
  })
  @IsString()
  @IsNotEmpty()
  transferType!: string;

  @ApiProperty({ description: 'Số tiền giao dịch' })
  @IsNumber()
  @IsNotEmpty()
  transferAmount!: number;

  @ApiProperty({ description: 'Số dư tài khoản (lũy kế)' })
  @IsNumber()
  @IsNotEmpty()
  accumulated!: number;

  @ApiProperty({
    description: 'Tài khoản ngân hàng phụ (tài khoản định danh)',
    required: false,
  })
  @IsString()
  @IsOptional()
  subAccount?: string | null;

  @ApiProperty({ description: 'Mã tham chiếu của tin nhắn sms' })
  @IsString()
  @IsNotEmpty()
  referenceCode!: string;

  @ApiProperty({ description: 'Toàn bộ nội dung tin nhắn sms' })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
