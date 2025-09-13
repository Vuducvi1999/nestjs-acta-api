import { Attachment } from '@prisma/client';
import { NewsCategory } from '@prisma/client';

export class UserResponseDto {
  id: string;
  fullName: string;
  email: string;
  avatar: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }

  static fromUser(user: any): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
    };
  }
}

export class NewsCommentResponseDto {
  id: string;
  content: string;
  userId: string;
  parentId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  user: UserResponseDto;
  parent: NewsCommentResponseDto | null;
  replies: NewsCommentResponseDto[];

  constructor(partial: Partial<NewsCommentResponseDto>) {
    Object.assign(this, partial);
  }

  static fromComment(comment: any): NewsCommentResponseDto {
    return {
      id: comment.id,
      content: comment.content,
      userId: comment.userId,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      deletedAt: comment.deletedAt,
      user: UserResponseDto.fromUser(comment.user),
      parent: comment.parent
        ? NewsCommentResponseDto.fromComment(comment.parent)
        : null,
      replies: comment.replies
        ? comment.replies.map(NewsCommentResponseDto.fromComment)
        : [],
    };
  }
}

export class NewsLikeResponseDto {
  id: string;
  userId: string;
  isLiked: boolean;
  newsItemId: string;

  constructor(partial: Partial<NewsLikeResponseDto>) {
    Object.assign(this, partial);
  }

  static fromLike(like: any): NewsLikeResponseDto {
    return {
      id: like.id,
      userId: like.userId,
      isLiked: like.isLiked,
      newsItemId: like.newsItemId,
    };
  }
}

export class NewsRatingResponseDto {
  id: string;
  userId: string;
  newsItemId: string;
  rating: number;

  constructor(partial: Partial<NewsRatingResponseDto>) {
    Object.assign(this, partial);
  }

  static fromRating(rating: any): NewsRatingResponseDto {
    return {
      id: rating.id,
      userId: rating.userId,
      newsItemId: rating.newsItemId,
      rating: rating.rating,
    };
  }
}

export class NewsMuxDataResponseDto {
  id: string;
  assetId: string;
  playbackId?: string;

  constructor(partial: Partial<NewsMuxDataResponseDto>) {
    Object.assign(this, partial);
  }

  static fromMuxData(muxData: any): NewsMuxDataResponseDto {
    return {
      id: muxData.id,
      assetId: muxData.assetId,
      playbackId: muxData.playbackId,
    };
  }
}

export class NewsItemResponseDto {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: NewsCategory;
  duration: string;
  level: string;
  views: number;
  rating: number;
  location: string;
  date: Date;
  isPublished: boolean;
  imageUrls: string[];
  videoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
  author: UserResponseDto;
  muxData: NewsMuxDataResponseDto[];
  comments: NewsCommentResponseDto[];
  likes: NewsLikeResponseDto[];
  ratings: NewsRatingResponseDto[];
}

export interface PaginatedNewsCommentsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class PaginatedNewsItemResponseDto {
  data: NewsItemResponseDto[];
  total: number;
  page: number;
  totalPages: number;

  static fromPaginatedResult(result: any): PaginatedNewsItemResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
