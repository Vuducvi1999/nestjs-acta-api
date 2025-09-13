import {
  DocumentAttachmentResponseDto,
  DocumentChapterMuxDataResponseDto,
  DocumentUploaderResponseDto,
} from './document-response.dto';

// Chapter with user progress
export class ChapterWithProgressDto {
  id: string;

  title: string;
  content?: string | null;
  position: number;
  views: number;
  videoUrl?: string | null;

  muxData?: DocumentChapterMuxDataResponseDto | null;

  isPublished: boolean;

  isCompleted: boolean; // User-specific

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  publishedAt?: Date | null;

  constructor(partial: Partial<ChapterWithProgressDto>) {
    Object.assign(this, partial);
  }

  static fromChapter(chapter: any): ChapterWithProgressDto {
    return {
      id: chapter.id,
      title: chapter.title,
      content: chapter.content || null,
      position: chapter.position,
      views: chapter.views || 0,
      videoUrl: chapter.videoUrl || null,
      muxData: chapter.muxData
        ? DocumentChapterMuxDataResponseDto.fromMuxData(chapter.muxData)
        : null,
      isPublished: chapter.isPublished || false,
      isCompleted: chapter.isCompleted || false, // User-specific progress
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
      deletedAt: chapter.deletedAt || null,
      publishedAt: chapter.publishedAt || null,
    };
  }
}

// Document with user-document flags and enriched chapters
export class UserDocumentWithProgressResponseDto {
  id: string;

  title: string;
  description?: string | null;
  categoryId: string;
  categoryName: string;
  slug?: string | null;
  downloads: number;
  thumbnailUrl?: string | null; // Optional thumbnail URL
  uploader: DocumentUploaderResponseDto;
  isPublished: boolean;

  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date | null;

  attachments: DocumentAttachmentResponseDto[];
  chapters: ChapterWithProgressDto[];

  isFollowing: boolean;
  isFavorite: boolean;
  lastViewed: boolean;

  constructor(partial: Partial<UserDocumentWithProgressResponseDto>) {
    Object.assign(this, partial);
  }

  static fromDocumentWithProgress(
    doc: any,
    isFollowing: boolean,
    isFavorite: boolean,
    lastViewed: boolean,
  ): UserDocumentWithProgressResponseDto {
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      categoryId: doc.category.id,
      categoryName: doc.category.name,
      slug: doc.slug,
      downloads: doc.downloads,
      thumbnailUrl: doc.thumbnail?.fileUrl || null,
      uploader: {
        id: doc.uploader.id,
        fullName: doc.uploader.fullName,
        referenceId: doc.uploader.referenceId,
        avatarUrl: doc.uploader.avatarUrl || null,
        verificationDate: doc.uploader.verificationDate || null,
      },
      isPublished: doc.isPublished,

      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      publishedAt: doc.publishedAt || null,

      attachments: (doc.attachments || []).map(
        (att: any) => new DocumentAttachmentResponseDto(att),
      ),
      chapters: (doc.chapters || []).map((ch: any) =>
        ChapterWithProgressDto.fromChapter(ch),
      ),
      isFollowing,
      isFavorite,
      lastViewed,
    };
  }
}

// Paginated response wrapper
export class PaginatedUserDocumentWithProgressResponseDto {
  data: UserDocumentWithProgressResponseDto[];
  total: number;
  page: number;
  totalPages: number;

  static fromPaginatedResult(
    result: any,
  ): PaginatedUserDocumentWithProgressResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
