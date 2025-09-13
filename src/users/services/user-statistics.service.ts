import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { UserStatisticsResponse } from '../models';

@Injectable()
export class UserStatisticsService {
  private readonly logger = new Logger(UserStatisticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserStatistics(userId: string): Promise<UserStatisticsResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        referrals: { select: { id: true } },
        posts: { select: { id: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const postIds = user.posts.map((p) => p.id);
    let likesCount = 0;

    if (postIds.length > 0) {
      likesCount = await this.prisma.reaction.count({
        where: {
          postId: { in: postIds },
          type: 'LIKE',
        },
      });
    }

    return {
      createdAt: user.createdAt,
      referralsCount: user.referrals.length,
      postsCount: user.posts.length,
      likesCount,
    };
  }
}
