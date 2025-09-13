export class ConversationResponseDto {
  id: string;

  name?: string;
  imageUrl?: string;
  isGroup: boolean;
  isArchived: boolean;
  lastMessageAt?: Date;
  lastMessageContent?: string;
  unseenMsgCount: number;

  createdAt: Date;
  updatedAt: Date;

  // Expose creator to allow FE to determine OWNER controls
  createdById?: string;

  constructor(partial: Partial<ConversationResponseDto>) {
    Object.assign(this, partial);
  }

  static fromModel(doc: any): ConversationResponseDto {
    // For 1-1 conversations, get the other user's info
    let displayName = doc.name;
    let displayImageUrl = doc.imageUrl;

    if (!doc.isGroup && doc.members && doc.members.length > 0) {
      // Find the other user in the conversation (not the current user)
      const otherMember = doc.members.find(
        (member: any) => member.user && member.user.id !== doc._currentUserId,
      );

      if (otherMember && otherMember.user) {
        displayName = otherMember.user.fullName;
        displayImageUrl = otherMember.user.avatar?.fileUrl;
      }
    }

    // For group conversations, use the stored name and imageUrl
    // For 1-1 conversations, use the other user's info (which may override stored values)

    return {
      id: doc.id,
      name: displayName,
      imageUrl: displayImageUrl,
      isGroup: doc.isGroup,
      isArchived: doc.isArchived,
      lastMessageAt: doc.lastMessageAt,
      lastMessageContent: doc.lastMessageContent,
      unseenMsgCount: doc.unseenMsgCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdById: doc.createdById,
    };
  }
}

export class SuggestedConversationUserDto {
  id: string;
  fullName: string;
  status: string;
  avatarUrl?: string;
  referenceId: string;
  verificationDate?: Date;
  role: string;
  totalReferrals: number;
  depth: number;

  constructor(partial: Partial<SuggestedConversationUserDto>) {
    Object.assign(this, partial);
  }

  static fromModel(user: any): SuggestedConversationUserDto {
    return {
      id: user.id,
      fullName: user.fullName,
      status: user.status,
      avatarUrl: user.avatarUrl,
      referenceId: user.referenceId,
      verificationDate: user.verificationDate,
      role: user.role,
      totalReferrals: user.totalReferrals,
      depth: user.depth,
    };
  }
}

export class SuggestedConversationsResponseDto {
  suggestedUsers: SuggestedConversationUserDto[];

  static fromSuggestedUsers(users: any[]): SuggestedConversationsResponseDto {
    return {
      suggestedUsers: users.map(SuggestedConversationUserDto.fromModel),
    };
  }
}

export class RecentConversationsDto {
  recentConversations: ConversationResponseDto[];
  unseenMsgCount: number;

  static fromRecentConversations(result: any): RecentConversationsDto {
    return {
      recentConversations: result.map(ConversationResponseDto.fromModel),
      unseenMsgCount: result.reduce(
        (acc: number, conversation: any) => acc + conversation.unseenMsgCount,
        0,
      ),
    };
  }
}

export class PaginatedConversationsResponseDto {
  data: ConversationResponseDto[];

  total: number;

  page: number;

  totalPages: number;

  static fromPaginatedConversations(
    result: any,
  ): PaginatedConversationsResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
