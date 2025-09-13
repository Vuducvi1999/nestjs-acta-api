import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class StatisticsQueryDto {
  @ApiProperty({
    description: 'Statistics view type',
    enum: ['mostReferrals', 'mostPostsReactions', 'mostSinglePostLikes'],
    required: false,
    default: 'mostReferrals',
  })
  @IsOptional()
  @IsIn(['mostReferrals', 'mostPostsReactions', 'mostSinglePostLikes'])
  view?: 'mostReferrals' | 'mostPostsReactions' | 'mostSinglePostLikes';

  @ApiProperty({
    description: 'Time period for statistics',
    enum: ['day', 'week', 'month', 'year'],
    required: false,
    default: 'month',
  })
  @IsOptional()
  @IsString()
  @IsIn(['day', 'week', 'month', 'year'])
  period?: 'day' | 'week' | 'month' | 'year';

  @ApiProperty({
    description: 'Filter by user reference ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({
    description: 'Search query for filtering results',
    required: false,
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  limit?: number;
}
