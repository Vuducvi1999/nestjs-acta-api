export class MessageResponseDto {
  id: string;
  content?: string;
  imageUrls?: string[]; // Add support for multiple images
  conversationId: string;
  senderId: string;
  createdAt: Date;
  updatedAt: Date;

  // Sender information
  sender: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };

  // Mentions
  mentions?: Array<{
    id: string;
    fullName: string;
    avatarUrl?: string;
  }>;

  // Attachments
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
  }>;

  // Seen by users
  seenBy?: Array<{
    id: string;
    fullName: string;
    avatarUrl?: string;
  }>;

  constructor(partial: Partial<MessageResponseDto>) {
    Object.assign(this, partial);
  }

  static fromModel(doc: any): MessageResponseDto {
    return {
      id: doc.id,
      content: doc.content,
      imageUrls: doc.imageUrls, // Add support for multiple images
      conversationId: doc.conversationId,
      senderId: doc.senderId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      sender: {
        id: doc.sender.id,
        fullName: doc.sender.fullName,
        avatarUrl: doc.sender.avatar?.fileUrl,
      },
      mentions: doc.mentions?.map((mention: any) => ({
        id: mention.id,
        fullName: mention.fullName,
        avatarUrl: mention.avatar?.fileUrl,
      })),
      attachments: doc.attachments?.map((attachment: any) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
      })),
      seenBy: doc.seenBy?.map((user: any) => ({
        id: user.id,
        fullName: user.fullName,
        avatarUrl: user.avatar?.fileUrl,
      })),
    };
  }
}

export class PaginatedMessagesResponseDto {
  data: MessageResponseDto[];
  total: number;
  page: number;
  totalPages: number;

  static fromPaginatedMessages(result: any): PaginatedMessagesResponseDto {
    return {
      data: result.data.map(MessageResponseDto.fromModel),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
