import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePostCommentDto {
  @ApiProperty({ description: 'Comment content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Parent comment ID for replies',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdatePostCommentDto {
  @ApiProperty({ description: 'Updated comment content' })
  @IsNotEmpty()
  @IsString()
  content: string;
}

export class CommentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  postId: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  likeCount: number;

  @ApiProperty({ required: false })
  isLikedByCurrentUser?: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  deletedAt?: Date;

  @ApiProperty()
  user: {
    id: string;
    fullName: string;
    status: string;
    avatarUrl?: string;
    referenceId: string;
    verificationDate?: Date;
    role: string;
  };

  @ApiProperty({ type: [CommentResponseDto], required: false })
  replies?: CommentResponseDto[];

  @ApiProperty({ type: [Object], required: false })
  reactions?: Array<{
    id: string;
    type: string;
    userId: string;
    commentId: string;
    user: {
      id: string;
      fullName: string;
      status: string;
      avatarUrl?: string;
      referenceId: string;
      verificationDate?: Date;
      role: string;
    };
  }>;

  @ApiProperty({ required: false })
  userReaction?: string;

  @ApiProperty({ type: [Object], required: false })
  groupedReactions?: Array<{ type: string; count: number }>;

  static fromComment(comment: any, currentUserId?: string): CommentResponseDto {
    // Build reactions array from likes
    const reactions = (comment.likes || []).map((like: any) => ({
      id: like.id,
      type: like.type,
      userId: like.userId,
      commentId: like.commentId,
      user: {
        id: like.user.id,
        fullName: like.user.fullName,
        status: like.user.status,
        avatarUrl: like.user.avatar?.fileUrl,
        referenceId: like.user.referenceId,
        verificationDate: like.user.verificationDate,
        role: like.user.role,
      },
    }));
    // Find current user's reaction
    const userReaction = currentUserId
      ? (
          comment.likes.map((like: any) => {
            return {
              ...like,
              user: {
                id: like.user.id,
                fullName: like.user.fullName,
                status: like.user.status,
                avatarUrl: like.user.avatar?.fileUrl,
                referenceId: like.user.referenceId,
                verificationDate: like.user.verificationDate,
                role: like.user.role,
              },
            };
          }) || []
        ).find((like: any) => like.userId === currentUserId)?.type
      : undefined;
    // Grouped reactions
    const groupedMap: Record<string, number> = {};
    (comment.likes || []).forEach((like: any) => {
      groupedMap[like.type] = (groupedMap[like.type] || 0) + 1;
    });
    const groupedReactions = Object.entries(groupedMap).map(
      ([type, count]) => ({ type, count }),
    );
    return {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      parentId: comment.parentId,
      userId: comment.userId,
      likeCount: comment.likeCount || 0,
      isLikedByCurrentUser: currentUserId
        ? comment.likes?.some((like: any) => like.userId === currentUserId)
        : false,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      user: {
        id: comment.user.id,
        fullName: comment.user.fullName,
        status: comment.user.status,
        avatarUrl: comment.user.avatar?.fileUrl,
        referenceId: comment.user.referenceId,
        verificationDate: comment.user.verificationDate,
        role: comment.user.role,
      },
      replies: comment.replies?.map((reply: any) =>
        CommentResponseDto.fromComment(reply, currentUserId),
      ),
      reactions,
      userReaction,
      groupedReactions,
    };
  }
}
