export class DocumentCommentResponseDto {
  id: string;
  content: string;
  userId: string;
  documentId: string;
  parentId?: string | null;
  user: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  likes: number;
  isLiked: boolean;
  repliesCount: number;
  replies?: DocumentCommentResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(
    entity: any,
    currentUserId?: string,
  ): DocumentCommentResponseDto {
    return {
      id: entity.id,
      content: entity.content,
      userId: entity.userId,
      documentId: entity.documentId,
      parentId: entity.parentId,
      user: {
        id: entity.user.id,
        fullName: entity.user.fullName,
        avatarUrl: entity.user.avatar?.fileUrl || null,
      },
      likes: entity._count?.likes ?? entity.likes?.length ?? 0,
      isLiked: !!entity.likes?.find(
        (like: any) => like.userId === currentUserId,
      ),
      repliesCount: entity._count?.replies ?? entity.replies?.length ?? 0,
      replies: entity.replies
        ? entity.replies.map((r: any) =>
            DocumentCommentResponseDto.fromEntity(r, currentUserId),
          )
        : [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
