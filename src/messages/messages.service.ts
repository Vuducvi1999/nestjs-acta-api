import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Prisma, Role } from '@prisma/client';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../common/services/prisma.service';
import { ConversationsQueryDto } from './dto/conversations-query.dto';
import {
  ConversationResponseDto,
  PaginatedConversationsResponseDto,
  RecentConversationsDto,
  SuggestedConversationsResponseDto,
} from './dto/conversations-response.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessageResponseDto } from './dto/messages-response.dto';
import { SuggestedConversationsQueryDto } from './dto/suggested-conversations-query.dto';
import { CONVERSATION_CONSTANTS } from './messages.constants';
import { SendMessagePayload } from './messages.gateway';
import { MessagesSocketEmitterService } from './services/messages-socket-emitter.service';
import { MessagesHelpers } from './messages.helper';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly messagesSocketEmitter: MessagesSocketEmitterService,
  ) {}

  async getRecentConversations(user: JwtPayload) {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      const cacheKey = MessagesHelpers.generateRecentConversationsCacheKey(
        user.id,
      );

      const cachedData =
        await this.cacheManager.get<RecentConversationsDto>(cacheKey);

      if (cachedData) return cachedData;

      const recentConversations = await this.prisma.conversation.findMany({
        where: {
          members: {
            some: {
              userId: existUser.id,
              isHidden: false,
            },
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
        take: 3,
        include: {
          members: {
            where: {
              userId: {
                not: existUser.id,
              },
            },
            select: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      // Calculate unseenMsgCount for each conversation
      const formattedConversations = await Promise.all(
        recentConversations.map(async (conversation) => {
          const lastMessage = conversation.messages[0];
          const unseenMsgCount =
            await MessagesHelpers.countUnseenMessagesForUser(
              this.prisma,
              conversation.id,
              existUser.id,
            );
          return {
            ...conversation,
            unseenMsgCount,
            lastMessageAt: lastMessage?.createdAt,
            lastMessageContent: lastMessage?.content || null,
          };
        }),
      );

      const result = RecentConversationsDto.fromRecentConversations(
        formattedConversations.map((conversation) => ({
          ...conversation,
          _currentUserId: existUser.id,
        })),
      );

      // Clear cache to ensure fresh data with user info
      await this.cacheManager.del(cacheKey);
      await this.cacheManager.set(cacheKey, result, 30000);

      return result;
    } catch (error) {
      MessagesHelpers.handleError(error, 'getRecentConversations', this.logger);
    }
  }

  async findAll(
    query: ConversationsQueryDto,
    user: JwtPayload,
  ): Promise<PaginatedConversationsResponseDto> {
    try {
      const cacheKey = MessagesHelpers.generateConversationsCacheKey(
        user.id,
        query,
      );

      const cachedData =
        await this.cacheManager.get<PaginatedConversationsResponseDto>(
          cacheKey,
        );

      if (cachedData) return cachedData;

      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      const page = query.page || CONVERSATION_CONSTANTS.DEFAULT_PAGE;
      const limit = query.limit || CONVERSATION_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      const where = MessagesHelpers.buildConversationsWhereClause(
        existUser,
        query,
      );
      const orderBy = MessagesHelpers.buildConversationsOrderBy();

      const prismaQuery = {
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          members: {
            select: {
              isHidden: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc' as Prisma.SortOrder,
            },
            take: 1,
          },
        },
      };

      const total = await this.prisma.conversation.count({ where });
      const conversations =
        await this.prisma.conversation.findMany(prismaQuery);

      // Calculate unseenMsgCount for each conversation
      const conversationsWithUnseen = await Promise.all(
        conversations.map(async (conversation) => {
          const lastMessage = conversation.messages[0];
          const unseenMsgCount =
            await MessagesHelpers.countUnseenMessagesForUser(
              this.prisma,
              conversation.id,
              existUser.id,
            );
          return {
            ...conversation,
            unseenMsgCount,
            lastMessageAt: lastMessage?.createdAt,
            lastMessageContent: lastMessage?.content || null,
          };
        }),
      );

      // Filter by unreadOnly if requested
      const filteredConversations = query.unreadOnly
        ? conversationsWithUnseen.filter((c) => c.unseenMsgCount > 0)
        : conversationsWithUnseen;

      const paginatedResponse =
        PaginatedConversationsResponseDto.fromPaginatedConversations({
          data: filteredConversations.map((conversation) =>
            ConversationResponseDto.fromModel({
              ...conversation,
              _currentUserId: existUser.id,
            }),
          ),
          total: query.unreadOnly ? filteredConversations.length : total,
          page,
          totalPages: Math.ceil(
            (query.unreadOnly ? filteredConversations.length : total) / limit,
          ),
        });

      await this.cacheManager.set(
        cacheKey,
        paginatedResponse,
        CONVERSATION_CONSTANTS.CACHE_TTL,
      );

      return paginatedResponse;
    } catch (error) {
      MessagesHelpers.handleError(error, 'findAll', this.logger);
    }
  }

  async getSuggestedConversations(
    user: JwtPayload,
    query?: SuggestedConversationsQueryDto,
  ) {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      const hasSearchQuery = query?.search?.trim();

      const cacheKey = MessagesHelpers.generateSuggestedConversationsCacheKey(
        user.id,
        query?.limit,
        query?.search,
      );

      // For search queries, don't use cache to ensure fresh results
      if (!hasSearchQuery) {
        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) return cachedData;
      }

      let suggestedUsers;
      let descendantDepthMap = new Map<string, number>();

      if (hasSearchQuery) {
        const searchTerm = query!.search!.trim();

        // Check if user is admin - admins can search all users
        if (existUser.role === 'admin') {
          // Admin can search all users
          const searchConditions = {
            OR: [
              {
                fullName: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
              {
                referenceId: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
              { email: { contains: searchTerm, mode: 'insensitive' as const } },
              {
                phoneNumber: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            ],
          };

          suggestedUsers = await this.prisma.user.findMany({
            where: {
              id: { not: existUser.id }, // Exclude current user
              ...searchConditions,
            },
            include: {
              avatar: { select: { fileUrl: true } },
              referrals: { where: { deletedAt: null } },
            },
            take: query?.limit || 50,
          });
        } else {
          // Regular users can only search within referral tree
          // First, get all users in the referral tree (up to 2 levels deep)
          const closures = await this.prisma.userReferralClosure.findMany({
            where: {
              ancestorId: existUser.referenceId,
              depth: { lte: 2, gte: 1 },
            },
            select: { descendantId: true, depth: true },
          });

          if (!closures.length) {
            return [];
          }

          // Map descendantId to depth
          closures.forEach((c) =>
            descendantDepthMap.set(c.descendantId, c.depth),
          );

          const searchConditions = {
            OR: [
              {
                fullName: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
              {
                referenceId: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
              { email: { contains: searchTerm, mode: 'insensitive' as const } },
              {
                phoneNumber: {
                  contains: searchTerm,
                  mode: 'insensitive' as const,
                },
              },
            ],
          };

          suggestedUsers = await this.prisma.user.findMany({
            where: {
              referenceId: { in: Array.from(descendantDepthMap.keys()) },
              id: { not: existUser.id }, // Exclude current user
              ...searchConditions,
            },
            include: {
              avatar: { select: { fileUrl: true } },
              referrals: { where: { deletedAt: null } },
            },
            take: query?.limit || 50,
          });
        }
      } else {
        // Get admin users first (always show admins for regular users)
        const adminUsers = await this.prisma.user.findMany({
          where: {
            role: 'admin',
            id: { not: existUser.id }, // Exclude current user
          },
          include: {
            avatar: {
              select: {
                fileUrl: true,
              },
            },
            referrals: {
              where: {
                deletedAt: null,
              },
            },
          },
        });

        // Get referral tree users
        const closures = await this.prisma.userReferralClosure.findMany({
          where: {
            ancestorId: existUser.referenceId,
            depth: { lte: 2, gte: 1 },
          },
          select: { descendantId: true, depth: true },
        });

        let referralUsers: any[] = [];
        if (closures.length > 0) {
          // Map descendantId to depth
          closures.forEach((c) =>
            descendantDepthMap.set(c.descendantId, c.depth),
          );

          referralUsers = await this.prisma.user.findMany({
            where: {
              referenceId: { in: Array.from(descendantDepthMap.keys()) },
              id: { not: existUser.id }, // Exclude current user
            },
            include: {
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referrals: {
                where: {
                  deletedAt: null,
                },
              },
            },
          });
        }

        // Combine admin users and referral users, with admins first
        // Create a Map to track unique users, prioritizing admins
        const userMap = new Map();

        // Add admin users first (they get priority)
        adminUsers.forEach((user) => {
          userMap.set(user.id, user);
        });

        // Add referral users (only if not already added as admin)
        referralUsers.forEach((user) => {
          if (!userMap.has(user.id)) {
            userMap.set(user.id, user);
          }
        });

        // Convert back to array
        const uniqueUsers = Array.from(userMap.values());

        // Apply limit
        const limit = query?.limit || 20;
        suggestedUsers = uniqueUsers.slice(0, limit);
      }

      // Sort users based on whether we're searching or using referral tree
      let sortedUsers;
      if (hasSearchQuery) {
        if (existUser.role === 'admin') {
          // For admin search results, sort by referral count (desc), then by name (asc)
          sortedUsers = suggestedUsers.sort((a, b) => {
            const referralCountA = a.referrals.length;
            const referralCountB = b.referrals.length;

            if (referralCountA !== referralCountB) {
              return referralCountB - referralCountA;
            }

            // If referral counts are equal, sort by name
            return a.fullName.localeCompare(b.fullName);
          });
        } else {
          // For regular user search results within referral tree, sort by referral count (desc), then by depth (asc), then by name (asc)
          sortedUsers = suggestedUsers.sort((a, b) => {
            const referralCountA = a.referrals.length;
            const referralCountB = b.referrals.length;

            if (referralCountA !== referralCountB) {
              return referralCountB - referralCountA;
            }

            const depthA = descendantDepthMap.get(a.referenceId) ?? 99;
            const depthB = descendantDepthMap.get(b.referenceId) ?? 99;

            if (depthA !== depthB) {
              return depthA - depthB;
            }

            // If depths are equal, sort by name
            return a.fullName.localeCompare(b.fullName);
          });
        }
      } else {
        // For referral tree, sort by referral count (desc) and then by depth (asc)
        sortedUsers = suggestedUsers.sort((a, b) => {
          const referralCountA = a.referrals.length;
          const referralCountB = b.referrals.length;

          if (referralCountA !== referralCountB) {
            return referralCountB - referralCountA;
          }

          const depthA = descendantDepthMap.get(a.referenceId) ?? 99;
          const depthB = descendantDepthMap.get(b.referenceId) ?? 99;
          return depthA - depthB;
        });
      }

      const result = sortedUsers.map((user) => ({
        id: user.id,
        fullName: user.fullName,
        status: user.status,
        avatarUrl: user.avatar?.fileUrl,
        referenceId: user.referenceId,
        verificationDate: user.verificationDate,
        role: user.role,
        totalReferrals: user.referrals.length,
        depth:
          existUser.role === 'admin'
            ? 0
            : descendantDepthMap.get(user.referenceId) || 0,
      }));

      const response =
        SuggestedConversationsResponseDto.fromSuggestedUsers(result);

      await this.cacheManager.set(cacheKey, response, 30000); // 30 seconds cache

      return response;
    } catch (error) {
      MessagesHelpers.handleError(
        error,
        'getSuggestedConversations',
        this.logger,
      );
    }
  }

  async createConversation(
    createConversationDto: CreateConversationDto,
    user: JwtPayload,
  ): Promise<ConversationResponseDto> {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      // Restrict group creation to admin or collaborator only
      const isPrivilegedCreator =
        existUser.role === Role.admin || existUser.role === Role.collaborator;
      if (createConversationDto.isGroup && !isPrivilegedCreator) {
        throw new ForbiddenException(
          'Only admin or collaborator can create group conversations',
        );
      }

      // Validate memberIds array
      if (
        !createConversationDto.memberIds ||
        createConversationDto.memberIds.length < 2
      ) {
        throw new Error('Conversation must have at least 2 members');
      }

      // Validate that all member IDs exist and are active
      const members = await this.prisma.user.findMany({
        where: {
          id: { in: createConversationDto.memberIds },
        },
        select: {
          id: true,
          fullName: true,
          avatar: {
            select: {
              fileUrl: true,
            },
          },
        },
      });

      if (members.length !== createConversationDto.memberIds.length) {
        throw new Error('Some users not found or inactive');
      }

      // Check if 1-on-1 conversation already exists
      if (
        !createConversationDto.isGroup &&
        createConversationDto.memberIds.length === 2
      ) {
        const existingConversation = await this.prisma.conversation.findFirst({
          where: {
            isGroup: false,
            members: {
              some: {
                userId: { in: createConversationDto.memberIds },
              },
            },
          },
          include: {
            members: true,
            messages: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        });

        const isExactMatch =
          existingConversation &&
          existingConversation.members.length === 2 &&
          createConversationDto.memberIds.every((id) =>
            existingConversation.members.some((m) => m.userId === id),
          );

        if (isExactMatch) {
          const currentMember = existingConversation.members.find(
            (m) => m.userId === existUser.id,
          );

          if (currentMember?.isHidden) {
            await this.prisma.conversationMember.update({
              where: {
                conversationId_userId: {
                  conversationId: existingConversation.id,
                  userId: existUser.id,
                },
              },
              data: {
                isHidden: false,
              },
            });
          }

          const conversationWithUnseen = {
            ...existingConversation,
            unseenMsgCount: await MessagesHelpers.countUnseenMessagesForUser(
              this.prisma,
              existingConversation.id,
              existUser.id,
            ),
            lastMessageAt: existingConversation.messages[0]?.createdAt || null,
            lastMessageContent:
              existingConversation.messages[0]?.content || null,
          };

          return ConversationResponseDto.fromModel(conversationWithUnseen);
        }
      }

      // Create new conversation
      const conversation = await this.prisma.conversation.create({
        data: {
          // For 1-1 conversations, don't store name and imageUrl - they will be derived from the other user
          name: createConversationDto.isGroup
            ? createConversationDto.name
            : null,
          imageUrl: createConversationDto.isGroup
            ? createConversationDto.imageUrl
            : null,
          isGroup: createConversationDto.isGroup || false,
          createdBy: {
            connect: { id: existUser.id },
          },
          members: {
            create: [
              // Always add the creator as OWNER
              {
                userId: existUser.id,
                role: 'OWNER' as const,
                isHidden: false,
              },
              // Add other members from memberIds (excluding creator to avoid duplicate)
              ...createConversationDto.memberIds
                .filter((memberId) => memberId !== existUser.id)
                .map((memberId) => ({
                  userId: memberId,
                  role: 'MEMBER' as const,
                  isHidden: false,
                })),
            ],
          },
        },
        include: {
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      // Clear cache for current user
      const cacheKey = MessagesHelpers.generateConversationsCacheKey(
        existUser.id,
        { page: 1, limit: CONVERSATION_CONSTANTS.DEFAULT_LIMIT },
      );
      await this.cacheManager.del(cacheKey);

      const conversationWithUnseen = {
        ...conversation,
        unseenMsgCount: 0,
        lastMessageAt: conversation.messages[0]?.createdAt || null,
        lastMessageContent: conversation.messages[0]?.content || null,
      };

      const response = ConversationResponseDto.fromModel(
        conversationWithUnseen,
      );

      // Emit to personal rooms of each member so their FE refreshes conversation list
      try {
        const memberIds = createConversationDto.memberIds;
        const uniqueMemberIds = Array.from(new Set(memberIds));
        this.messagesSocketEmitter.emitConversationCreatedToUsers(
          uniqueMemberIds,
          response,
        );
      } catch (e) {
        this.logger.warn(`Failed to emit conversationCreated: ${e?.message}`);
      }

      return response;
    } catch (error) {
      MessagesHelpers.handleError(error, 'createConversation', this.logger);
    }
  }

  async handleSendMessage(payload: SendMessagePayload) {
    const {
      conversationId,
      content,
      imageUrls,
      mentionIds,
      attachmentIds,
      senderId,
    } = payload;

    // Convert single imageUrl to imageUrls array for consistency
    const message = await this.prisma.message.create({
      data: {
        content,
        imageUrls,
        conversation: { connect: { id: conversationId } },
        sender: { connect: { id: senderId } },
        mentions: mentionIds?.length
          ? { connect: mentionIds.map((id) => ({ id })) }
          : undefined,
        attachments: attachmentIds?.length
          ? { connect: attachmentIds.map((id) => ({ id })) }
          : undefined,
        // Automatically mark sender's own message as read
        seenBy: { connect: { id: senderId } },
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatar: { select: { fileUrl: true } },
          },
        },
        mentions: true,
        attachments: true,
        seenBy: true,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async updateTypingStatus(
    conversationId: string,
    userId: string,
    isTyping: boolean,
  ) {
    await this.prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { isTyping },
    });
  }

  async markMessageAsRead(messageId: string, userId: string) {
    this.logger.log(`Marking message ${messageId} as read by user ${userId}`);

    try {
      // First check if message exists
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: { seenBy: true },
      });

      if (!message) {
        this.logger.error(`Message ${messageId} not found`);
        throw new Error(`Message ${messageId} not found`);
      }

      this.logger.log(
        `Found message: ${messageId}, current seenBy: ${message.seenBy?.length || 0} users`,
      );

      // Check if user has already seen this message
      const userAlreadySeen = message.seenBy?.some(
        (user) => user.id === userId,
      );
      if (userAlreadySeen) {
        this.logger.log(`User ${userId} has already seen message ${messageId}`);
        return;
      }

      const result = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          seenBy: {
            connect: { id: userId },
          },
        },
        include: { seenBy: true },
      });

      this.logger.log(
        `Successfully marked message ${messageId} as read by user ${userId}. New seenBy count: ${result.seenBy?.length || 0}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error marking message ${messageId} as read by user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  async markAllMessagesAsRead(conversationId: string, userId: string) {
    this.logger.log(
      `Marking all messages in conversation ${conversationId} as read by user ${userId}`,
    );

    try {
      // Get all unread messages for this user in this conversation
      const unreadMessages = await this.prisma.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId }, // Exclude messages sent by the user
          seenBy: {
            none: {
              id: userId,
            },
          },
        },
        include: { seenBy: true },
      });

      this.logger.log(
        `Found ${unreadMessages.length} unread messages in conversation ${conversationId} for user ${userId}`,
      );

      if (unreadMessages.length === 0) {
        this.logger.log(
          `No unread messages found for user ${userId} in conversation ${conversationId}`,
        );
        return { updatedCount: 0 };
      }

      // Mark all unread messages as read
      const updatePromises = unreadMessages.map((message) =>
        this.prisma.message.update({
          where: { id: message.id },
          data: {
            seenBy: {
              connect: { id: userId },
            },
          },
        }),
      );

      await Promise.all(updatePromises);

      this.logger.log(
        `Successfully marked ${unreadMessages.length} messages as read for user ${userId} in conversation ${conversationId}`,
      );
      return { updatedCount: unreadMessages.length };
    } catch (error) {
      this.logger.error(
        `Error marking all messages as read in conversation ${conversationId} for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  async getConversationMessages(
    conversationId: string,
    user: JwtPayload,
  ): Promise<MessageResponseDto[]> {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      // Check if user is a member of this conversation
      const conversationMember =
        await this.prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId: existUser.id,
            },
          },
        });

      if (!conversationMember) {
        throw new Error('User is not a member of this conversation');
      }

      // Get all messages for this conversation
      const messages = await this.prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: 'asc', // Oldest first for chat display
        },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatar: { select: { fileUrl: true } },
            },
          },
          mentions: {
            select: {
              id: true,
              fullName: true,
              avatar: { select: { fileUrl: true } },
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              mimeType: true,
            },
          },
          seenBy: {
            select: {
              id: true,
              fullName: true,
              avatar: { select: { fileUrl: true } },
            },
          },
        },
      });

      return messages.map(MessageResponseDto.fromModel);
    } catch (error) {
      MessagesHelpers.handleError(
        error,
        'getConversationMessages',
        this.logger,
      );
    }
  }

  async getLatestMessagesForAllConversations(
    user: JwtPayload,
    limit: number = 1,
  ): Promise<Record<string, MessageResponseDto[]>> {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      // Get all conversations where user is a member
      const userConversations = await this.prisma.conversation.findMany({
        where: {
          members: {
            some: {
              userId: existUser.id,
            },
          },
        },
        select: {
          id: true,
        },
      });

      const conversationIds = userConversations.map((c) => c.id);

      if (conversationIds.length === 0) {
        return {};
      }

      // Get latest messages for all conversations
      const latestMessages = await this.prisma.message.findMany({
        where: {
          conversationId: {
            in: conversationIds,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              avatar: { select: { fileUrl: true } },
            },
          },
          mentions: {
            select: {
              id: true,
              fullName: true,
              avatar: { select: { fileUrl: true } },
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              mimeType: true,
            },
          },
          seenBy: {
            select: {
              id: true,
              fullName: true,
              avatar: { select: { fileUrl: true } },
            },
          },
        },
      });

      // Group messages by conversation ID
      const messagesByConversation: Record<string, MessageResponseDto[]> = {};

      latestMessages.forEach((message) => {
        if (!messagesByConversation[message.conversationId]) {
          messagesByConversation[message.conversationId] = [];
        }

        // Only add if we haven't reached the limit for this conversation
        if (messagesByConversation[message.conversationId].length < limit) {
          messagesByConversation[message.conversationId].push(
            MessageResponseDto.fromModel(message),
          );
        }
      });

      // Sort messages within each conversation by createdAt asc (oldest first)
      Object.keys(messagesByConversation).forEach((conversationId) => {
        messagesByConversation[conversationId].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });

      return messagesByConversation;
    } catch (error) {
      MessagesHelpers.handleError(
        error,
        'getLatestMessagesForAllConversations',
        this.logger,
      );
      return {};
    }
  }

  async toggleConversationVisibility(
    conversationId: string,
    isHidden: boolean,
    user: JwtPayload,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      // Check if user is a member of this conversation
      const conversationMember =
        await this.prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId: existUser.id,
            },
          },
        });

      if (!conversationMember) {
        throw new Error('User is not a member of this conversation');
      }

      // Update the isHidden status
      await this.prisma.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: existUser.id,
          },
        },
        data: {
          isHidden,
        },
      });

      // Clear cache for current user to refresh conversations
      const cacheKey = MessagesHelpers.generateConversationsCacheKey(
        existUser.id,
        { page: 1, limit: CONVERSATION_CONSTANTS.DEFAULT_LIMIT },
      );
      await this.cacheManager.del(cacheKey);

      // Clear recent conversations cache
      const recentCacheKey =
        MessagesHelpers.generateRecentConversationsCacheKey(existUser.id);
      await this.cacheManager.del(recentCacheKey);

      const action = isHidden ? 'hidden' : 'shown';
      this.logger.log(
        `User ${existUser.id} ${action} conversation ${conversationId}`,
      );

      return {
        success: true,
        message: `Conversation ${action} successfully`,
      };
    } catch (error) {
      MessagesHelpers.handleError(
        error,
        'toggleConversationVisibility',
        this.logger,
      );
    }
  }

  async getHiddenConversations(user: JwtPayload) {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      const hiddenConversations = await this.prisma.conversation.findMany({
        where: {
          members: {
            some: {
              userId: existUser.id,
              isHidden: true,
            },
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
        include: {
          members: {
            where: {
              userId: {
                not: existUser.id,
              },
            },
            select: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      // Calculate unseenMsgCount for each conversation
      const conversationsWithUnseen = await Promise.all(
        hiddenConversations.map(async (conversation) => {
          const lastMessage = conversation.messages[0];
          const unseenMsgCount =
            await MessagesHelpers.countUnseenMessagesForUser(
              this.prisma,
              conversation.id,
              existUser.id,
            );
          return {
            ...conversation,
            unseenMsgCount,
            lastMessageAt: lastMessage?.createdAt,
            lastMessageContent: lastMessage?.content || null,
          };
        }),
      );

      return conversationsWithUnseen.map((conversation) =>
        ConversationResponseDto.fromModel({
          ...conversation,
          _currentUserId: existUser.id,
        }),
      );
    } catch (error) {
      MessagesHelpers.handleError(error, 'getHiddenConversations', this.logger);
    }
  }

  async getAllConversationsIncludingHidden(
    user: JwtPayload,
    query?: ConversationsQueryDto,
  ) {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      const page = query?.page || CONVERSATION_CONSTANTS.DEFAULT_PAGE;
      const limit = query?.limit || CONVERSATION_CONSTANTS.DEFAULT_LIMIT;
      const skip = (page - 1) * limit;

      // Build where clause without isHidden filter
      const where: Prisma.ConversationWhereInput = {
        members: {
          some: {
            userId: existUser.id,
            // Note: No isHidden filter here, so it includes both visible and hidden
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
                      {
                        referenceId: { contains: search, mode: 'insensitive' },
                      },
                      { email: { contains: search, mode: 'insensitive' } },
                      {
                        phoneNumber: { contains: search, mode: 'insensitive' },
                      },
                    ],
                  },
                },
              },
            },
          ];
        }
      }

      const orderBy = MessagesHelpers.buildConversationsOrderBy();

      const prismaQuery = {
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          members: {
            select: {
              isHidden: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                },
              },
            },
          },
          messages: {
            orderBy: {
              createdAt: 'desc' as Prisma.SortOrder,
            },
            take: 1,
          },
        },
      };

      const total = await this.prisma.conversation.count({ where });
      const conversations =
        await this.prisma.conversation.findMany(prismaQuery);

      // Calculate unseenMsgCount for each conversation
      const conversationsWithUnseen = await Promise.all(
        conversations.map(async (conversation) => {
          const lastMessage = conversation.messages[0];
          const unseenMsgCount =
            await MessagesHelpers.countUnseenMessagesForUser(
              this.prisma,
              conversation.id,
              existUser.id,
            );

          // Get the current user's member info to check isHidden status
          const currentMember = conversation.members.find(
            (m) => m.user.id === existUser.id,
          );

          return {
            ...conversation,
            unseenMsgCount,
            lastMessageAt: lastMessage?.createdAt,
            lastMessageContent: lastMessage?.content || null,
            isHidden: currentMember?.isHidden || false,
          };
        }),
      );

      // Filter by unreadOnly if requested
      const filteredConversations = query?.unreadOnly
        ? conversationsWithUnseen.filter((c) => c.unseenMsgCount > 0)
        : conversationsWithUnseen;

      const paginatedResponse =
        PaginatedConversationsResponseDto.fromPaginatedConversations({
          data: filteredConversations.map((conversation) =>
            ConversationResponseDto.fromModel({
              ...conversation,
              _currentUserId: existUser.id,
            }),
          ),
          total: query?.unreadOnly ? filteredConversations.length : total,
          page,
          totalPages: Math.ceil(
            (query?.unreadOnly ? filteredConversations.length : total) / limit,
          ),
        });

      return paginatedResponse;
    } catch (error) {
      MessagesHelpers.handleError(
        error,
        'getAllConversationsIncludingHidden',
        this.logger,
      );
    }
  }

  async addMembers(
    conversationId: string,
    memberIds: string[],
    user: JwtPayload,
  ) {
    try {
      const existUser = await MessagesHelpers.validateAndFetchUser(
        this.prisma,
        user.id,
      );

      // Check conversation exists
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: true },
      });
      if (!conversation) throw new Error('Conversation not found');

      // Only OWNER can add (ADMINs are treated as OWNER by policy)
      const current = await this.prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: { conversationId, userId: existUser.id },
        },
      });
      const hasOwnerPrivilege =
        current?.role === 'OWNER' || existUser.role === 'admin';
      if (!hasOwnerPrivilege) {
        throw new Error('Only OWNER can add members');
      }

      // Exclude existing members
      const existingIds = new Set(conversation.members.map((m) => m.userId));
      const toAdd = memberIds.filter((id) => !existingIds.has(id));
      if (toAdd.length === 0) return { added: 0 };

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          members: {
            createMany: {
              data: toAdd.map((id) => ({
                userId: id,
                role: 'MEMBER' as const,
              })),
              skipDuplicates: true,
            },
          },
        },
      });

      // Invalidate caches
      const cacheKey = MessagesHelpers.generateConversationsCacheKey(
        existUser.id,
        { page: 1, limit: CONVERSATION_CONSTANTS.DEFAULT_LIMIT },
      );
      await this.cacheManager.del(cacheKey);

      // Fetch updated conversation to emit
      const updatedConversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: {
            select: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: { select: { fileUrl: true } },
                },
              },
              isHidden: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (updatedConversation) {
        const lastMessage = updatedConversation.messages[0];
        const conversationWithMeta: any = {
          ...updatedConversation,
          unseenMsgCount: 0,
          lastMessageAt: lastMessage?.createdAt,
          lastMessageContent: lastMessage?.content || null,
          _currentUserId: existUser.id,
        };
        const dto = ConversationResponseDto.fromModel(conversationWithMeta);

        // Emit update to all existing members
        const allMemberIds = updatedConversation.members.map((m) => m.user.id);
        this.messagesSocketEmitter.emitConversationUpdatedToUsers(
          allMemberIds,
          dto,
        );

        // Emit create to newly added users so they fetch and join, with unseen count 0 initially
        if (toAdd.length > 0) {
          this.messagesSocketEmitter.emitConversationCreatedToUsers(toAdd, dto);
        }

        // Create a system message announcing new members for context and unread behavior
        if (toAdd.length > 0) {
          const systemContent = `Đã thêm ${toAdd.length} thành viên mới vào nhóm`;
          const systemMessage = await this.prisma.message.create({
            data: {
              content: systemContent,
              conversation: { connect: { id: conversationId } },
              sender: { connect: { id: existUser.id } },
              // Do not auto mark as seen by the newly added users so they get unread
              seenBy: { connect: { id: existUser.id } },
            },
            include: {
              sender: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: { select: { fileUrl: true } },
                },
              },
              mentions: true,
              attachments: true,
              seenBy: true,
            },
          });

          // Update lastMessageAt
          await this.prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: new Date() },
          });

          // Emit as NEW_MESSAGE to the room so everyone, including new users (after joining), sees it
          this.messagesSocketEmitter.emitNewMessageToConversation(
            conversationId,
            systemMessage,
          );
        }
      }

      return { added: toAdd.length };
    } catch (error) {
      MessagesHelpers.handleError(error, 'addMembers', this.logger);
    }
  }
}
