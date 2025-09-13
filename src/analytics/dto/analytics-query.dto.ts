import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TimeframeType {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum PeriodType {
  DATE = 'date',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  RANGE = 'range',
}

export class AnalyticsQueryDto {
  @ApiProperty({
    enum: PeriodType,
    description: 'Period type for analytics data',
    example: PeriodType.MONTH,
  })
  @IsEnum(PeriodType)
  periodType: PeriodType;

  @ApiProperty({
    required: false,
    description: 'Start date (ISO format) - required for all period types',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    required: false,
    description:
      'End date (ISO format) - required only when periodType is RANGE',
    example: '2024-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

}
