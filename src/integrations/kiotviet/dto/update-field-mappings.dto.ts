import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductFieldMappingsDto {
  @ApiProperty({
    description: 'KiotViet field name for product ID',
    example: 'id',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    description: 'KiotViet field name for product code/SKU',
    example: 'code',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'KiotViet field name for product name',
    example: 'name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'KiotViet field name for product full name',
    example: 'fullName',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    description: 'KiotViet field name for product description',
    example: 'description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'KiotViet field name for category ID',
    example: 'categoryId',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: 'KiotViet field name for category name',
    example: 'categoryName',
  })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiProperty({
    description: 'KiotViet field name for trademark/brand ID',
    example: 'tradeMarkId',
  })
  @IsOptional()
  @IsString()
  tradeMarkId?: string;

  @ApiProperty({
    description: 'KiotViet field name for trademark/brand name',
    example: 'tradeMarkName',
  })
  @IsOptional()
  @IsString()
  tradeMarkName?: string;

  @ApiProperty({
    description: 'KiotViet field name for base price',
    example: 'basePrice',
  })
  @IsOptional()
  @IsString()
  basePrice?: string;

  @ApiProperty({
    description: 'KiotViet field name for tax type',
    example: 'taxType',
  })
  @IsOptional()
  @IsString()
  taxType?: string;

  @ApiProperty({
    description: 'KiotViet field name for tax rate',
    example: 'taxRate',
  })
  @IsOptional()
  @IsString()
  taxRate?: string;

  @ApiProperty({
    description: 'KiotViet field name for tax name',
    example: 'taxname',
  })
  @IsOptional()
  @IsString()
  taxname?: string;

  @ApiProperty({
    description: 'KiotViet field name for product weight',
    example: 'weight',
  })
  @IsOptional()
  @IsString()
  weight?: string;

  @ApiProperty({
    description: 'KiotViet field name for product unit',
    example: 'unit',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    description: 'KiotViet field name for conversion value',
    example: 'conversionValue',
  })
  @IsOptional()
  @IsString()
  conversionValue?: string;

  @ApiProperty({
    description: 'KiotViet field name for lot/serial control flag',
    example: 'isLotSerialControl',
  })
  @IsOptional()
  @IsString()
  isLotSerialControl?: string;

  @ApiProperty({
    description: 'KiotViet field name for batch expire control flag',
    example: 'isBatchExpireControl',
  })
  @IsOptional()
  @IsString()
  isBatchExpireControl?: string;

  @ApiProperty({
    description: 'KiotViet field name for active status',
    example: 'isActive',
  })
  @IsOptional()
  @IsString()
  isActive?: string;

  @ApiProperty({
    description: 'KiotViet field name for allows sale flag',
    example: 'allowsSale',
  })
  @IsOptional()
  @IsString()
  allowsSale?: string;

  @ApiProperty({
    description: 'KiotViet field name for has variants flag',
    example: 'hasVariants',
  })
  @IsOptional()
  @IsString()
  hasVariants?: string;

  @ApiProperty({
    description: 'KiotViet field name for product type',
    example: 'type',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({
    description: 'KiotViet field name for product images',
    example: 'images',
  })
  @IsOptional()
  @IsString()
  images?: string;

  @ApiProperty({
    description: 'KiotViet field name for order template',
    example: 'orderTemplate',
  })
  @IsOptional()
  @IsString()
  orderTemplate?: string;

  @ApiProperty({
    description: 'KiotViet field name for retailer ID',
    example: 'retailerId',
  })
  @IsOptional()
  @IsString()
  retailerId?: string;

  @ApiProperty({
    description: 'KiotViet field name for created date',
    example: 'createdDate',
  })
  @IsOptional()
  @IsString()
  createdDate?: string;

  @ApiProperty({
    description: 'KiotViet field name for modified date',
    example: 'modifiedDate',
  })
  @IsOptional()
  @IsString()
  modifiedDate?: string;
}

export class UpdateCustomerFieldMappingsDto {
  @ApiProperty({
    description: 'KiotViet field name for customer name',
    example: 'customerName',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'KiotViet field name for customer code',
    example: 'customerCode',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'KiotViet field name for customer phone',
    example: 'contactNumber',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'KiotViet field name for customer email',
    example: 'email',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'KiotViet field name for customer address',
    example: 'address',
  })
  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateOrderFieldMappingsDto {
  @ApiProperty({
    description: 'KiotViet field name for order code',
    example: 'orderCode',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'KiotViet field name for customer reference',
    example: 'customerCode',
  })
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiProperty({
    description: 'KiotViet field name for order items',
    example: 'orderDetails',
  })
  @IsOptional()
  @IsString()
  items?: string;

  @ApiProperty({
    description: 'KiotViet field name for order total',
    example: 'total',
  })
  @IsOptional()
  @IsString()
  total?: string;

  @ApiProperty({
    description: 'KiotViet field name for order status',
    example: 'status',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateFieldMappingsDto {
  @ApiProperty({
    description: 'Product field mappings between KiotViet and ACTA',
    type: UpdateProductFieldMappingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProductFieldMappingsDto)
  product?: UpdateProductFieldMappingsDto;

  @ApiProperty({
    description: 'Customer field mappings between KiotViet and ACTA',
    type: UpdateCustomerFieldMappingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCustomerFieldMappingsDto)
  customer?: UpdateCustomerFieldMappingsDto;

  @ApiProperty({
    description: 'Order field mappings between KiotViet and ACTA',
    type: UpdateOrderFieldMappingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateOrderFieldMappingsDto)
  order?: UpdateOrderFieldMappingsDto;
}
