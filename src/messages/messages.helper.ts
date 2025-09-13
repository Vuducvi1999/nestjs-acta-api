import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { USER_SELECT_FIELDS_WITH_AUTH } from './messages.constants';
import { ConversationsQueryDto } from './dto/conversations-query.dto';
import { Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload';

export class MessagesHelpers {
  private static readonly logger = new Logger(MessagesHelpers.name);

  static generateConversationsCacheKey(
    userId: string,
    query: ConversationsQueryDto,
  ): string {
    return `conversations:${userId}:${query.page}:${query.limit}`;
  }

  static generateRecentConversationsCacheKey(userId: string): string {
    return `recent-conversations:${userId}`;
  }

  static generateSuggestedConversationsCacheKey(
    userId: string,
    limit?: number,
    search?: string,
  ): string {
    const searchHash = search ? `:${Buffer.from(search).toString('base64')}` : '';
    return `suggested-conversations:${userId}:${limit || 20}${searchHash}`;
  }

  static async validateAndFetchUser(prisma: PrismaService, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT_FIELDS_WITH_AUTH,
    });

    if (!user) {
      throw new NotFoundException('User not authenticated');
    }

    return user;
  }

  static buildConversationsWhereClause(
    existUser: JwtPayload,
    query?: ConversationsQueryDto,
  ): Prisma.ConversationWhereInput {
    const where: Prisma.ConversationWhereInput = {
      members: {
        some: {
          userId: existUser.id,
          isHidden: false,
        },
      },
    };

    if (query) {
      if (typeof query.isGroup === 'boolean') {
        where.isGroup = query.isGroup;
      }
      if (query.search && query.search.trim()) {
        const search = query.search.trim();
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          {
            members: {
              some: {
                user: {
                  OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { referenceId: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phoneNumber: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ];
      }
    }
    return where;
  }

  static buildConversationsOrderBy(): Prisma.ConversationOrderByWithRelationInput[] {
    return [
      {
        lastMessageAt: Prisma.SortOrder.desc,
      },
    ];
  }

  static getConversationsIncludeClause() {
    return {
      members: {
        select: {
          user: {
            select: USER_SELECT_FIELDS_WITH_AUTH,
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: Prisma.SortOrder.desc,
        },
        take: 1,
      },
    };
  }

  static formatUserForResponse(user: any) {
    return {
      id: user.id,
      fullName: user.fullName,
      status: user.status,
      avatarUrl: user.avatar?.fileUrl,
      referenceId: user.referenceId,
      verificationDate: user.verificationDate,
      role: user.role,
    };
  }

  static handleError(error: any, operation: string, logger?: Logger): never {
    const loggerInstance = logger || this.logger;
    loggerInstance.error(
      `Error in messages - ${operation}: ${error.message}`,
      error.stack,
    );
    throw new BadRequestException(`Failed to ${operation}`);
  }

  static async countUnseenMessagesForUser(
    prisma: PrismaService,
    conversationId: string,
    userId: string,
  ): Promise<number> {
    return prisma.message.count({
      where: {
        conversationId,
        seenBy: {
          none: {
            id: userId,
          },
        },
      },
    });
  }
}
