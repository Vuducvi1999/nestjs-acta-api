import { ApiProperty } from '@nestjs/swagger';

export class MetricData {
  @ApiProperty({ description: 'Current period value' })
  current: number;

  @ApiProperty({ description: 'Previous period value' })
  previous: number;

  @ApiProperty({ description: 'Trend percentage (absolute value)' })
  trend: number;

  @ApiProperty({ description: 'Percentage change from previous period' })
  percentageChange: number;
}

export class AnalyticsResponseDto {
  @ApiProperty({ description: 'Total users metric', type: MetricData })
  totalUsers: MetricData;

  @ApiProperty({ description: 'New users metric', type: MetricData })
  newUsers: MetricData;

  @ApiProperty({ description: 'Total posts metric', type: MetricData })
  totalPosts: MetricData;

  @ApiProperty({ description: 'New posts metric', type: MetricData })
  newPosts: MetricData;

  @ApiProperty({ description: 'New comments metric', type: MetricData })
  newComments: MetricData;

  @ApiProperty({ description: 'New likes metric', type: MetricData })
  newLikes: MetricData;

  @ApiProperty({ description: 'Timestamp when data was generated' })
  generatedAt: Date;

  constructor(partial: Partial<AnalyticsResponseDto>) {
    Object.assign(this, partial);
  }
}
