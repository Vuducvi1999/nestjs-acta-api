import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

export class StatisticsUserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User full name' })
  fullName: string;

  @ApiProperty({ description: 'User avatar URL', required: false })
  avatarUrl?: string;

  @ApiProperty({ description: 'User account status', enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: 'User reference ID' })
  referenceId: string;

  @ApiProperty({ description: 'User verification date', required: false })
  verificationDate?: Date | null;

  @ApiProperty({ description: 'User role', enum: Role })
  role: Role;

  @ApiProperty({ description: 'User rank in the leaderboard' })
  rank: number;

  @ApiProperty({ description: 'Total number of referrals' })
  totalReferrals: number;

  @ApiProperty({ description: 'Total number of post reactions' })
  totalPostsReactions: number;
}

export class StatisticsPostUserDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User full name' })
  fullName: string;

  @ApiProperty({ description: 'User avatar URL', required: false })
  avatarUrl?: string;

  @ApiProperty({ description: 'User reference ID' })
  referenceId: string;
}

export class StatisticsPostResponseDto {
  @ApiProperty({ description: 'Post ID' })
  id: string;

  @ApiProperty({ description: 'Post title/content', required: false })
  title?: string;

  @ApiProperty({ description: 'Post thumbnail URL', required: false })
  thumbnailUrl?: string;

  @ApiProperty({
    description: 'Post author information',
    type: StatisticsPostUserDto,
  })
  user: StatisticsPostUserDto;

  @ApiProperty({ description: 'Number of reactions on the post' })
  reactionCount: number;

  @ApiProperty({ description: 'Post rank in the leaderboard' })
  rank: number;

  @ApiProperty({ description: 'Post publication date' })
  publishedAt: Date;
}

export class CurrentUserStatisticsRankingResponseDto {
  @ApiProperty({ description: 'Current user total referrals' })
  totalReferrals: number;

  @ApiProperty({ description: 'Current user total post reactions' })
  totalPostsReactions: number;

  @ApiProperty({ description: 'Current user total single post likes' })
  totalSinglePostLikes: number;

  @ApiProperty({ description: 'Current user rank' })
  rank: number;

  @ApiProperty({ description: 'Total number of users' })
  totalUsers: number;

  @ApiProperty({ description: 'Current user percentage ranking' })
  percentage: number;
}

export class PaginatedStatisticsResponseDto {
  @ApiProperty({
    description: 'Statistics data',
    type: [StatisticsUserResponseDto],
    isArray: true,
  })
  data: StatisticsUserResponseDto[] | StatisticsPostResponseDto[];

  @ApiProperty({ description: 'Current user statistics and ranking' })
  currentUserStatistics: CurrentUserStatisticsRankingResponseDto;

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  static fromPaginatedResult(result: any): PaginatedStatisticsResponseDto {
    return {
      data: result.data,
      currentUserStatistics: result.currentUserStatistics,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
