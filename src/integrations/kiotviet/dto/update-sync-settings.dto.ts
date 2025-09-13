import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSyncSettingsDto {
  @ApiProperty({
    description: 'Enable or disable automatic synchronization',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @ApiProperty({
    description: 'Sync interval in seconds (minimum 300 seconds)',
    example: 3600,
    minimum: 300,
    maximum: 86400,
  })
  @IsOptional()
  @IsNumber()
  @Min(300, {
    message: 'Sync interval must be at least 300 seconds (5 minutes)',
  })
  @Max(86400, {
    message: 'Sync interval cannot exceed 86400 seconds (24 hours)',
  })
  syncInterval?: number;

  @ApiProperty({
    description: 'Enable or disable product synchronization',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  syncProducts?: boolean;

  @ApiProperty({
    description: 'Enable or disable customer synchronization',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  syncCustomers?: boolean;

  @ApiProperty({
    description: 'Enable or disable order synchronization',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  syncOrders?: boolean;

  @ApiProperty({
    description: 'Enable or disable category synchronization',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  syncCategories?: boolean;

  @ApiProperty({
    description: 'Number of retry attempts for failed sync operations',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Retry attempts must be at least 1' })
  @Max(10, { message: 'Retry attempts cannot exceed 10' })
  retryAttempts?: number;

  @ApiProperty({
    description: 'Delay between retry attempts in milliseconds',
    example: 5000,
    minimum: 1000,
    maximum: 30000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000, { message: 'Retry delay must be at least 1000ms (1 second)' })
  @Max(30000, { message: 'Retry delay cannot exceed 30000ms (30 seconds)' })
  retryDelay?: number;
}
