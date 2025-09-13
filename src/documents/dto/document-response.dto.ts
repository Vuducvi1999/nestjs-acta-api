export class DocumentAttachmentResponseDto {
  id: string;

  fileName: string;
  fileUrl: string;
  mimeType: string;

  constructor(partial: Partial<DocumentAttachmentResponseDto>) {
    Object.assign(this, partial);
  }

  static fromAttachment(attachment: any): DocumentAttachmentResponseDto {
    return {
      id: attachment.id,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
    };
  }
}

export class DocumentChapterMuxDataResponseDto {
  id: string;

  assetId: string;
  playbackId?: string;

  constructor(partial: Partial<DocumentChapterMuxDataResponseDto>) {
    Object.assign(this, partial);
  }

  static fromMuxData(muxData: any): DocumentChapterMuxDataResponseDto {
    return {
      id: muxData.id,
      assetId: muxData.assetId,
      playbackId: muxData.playbackId,
    };
  }
}

export class DocumentChapterResponseDto {
  id: string;

  title: string;
  content?: string;
  position: number;
  views: number;
  videoUrl?: string;
  isPublished: boolean;

  muxData?: DocumentChapterMuxDataResponseDto;

  // Optional user-specific progression flags for generic list when provided
  isCompleted?: boolean;

  documentId: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  publishedAt?: Date | null;

  constructor(partial: Partial<DocumentChapterResponseDto>) {
    Object.assign(this, partial);
  }

  static fromChapter(chapter: any): DocumentChapterResponseDto {
    return {
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
      position: chapter.position,
      views: chapter.views,
      videoUrl: chapter.videoUrl,
      isPublished: chapter.isPublished,
      muxData: chapter.muxData,
      documentId: chapter.documentId,
      // pass-through optional user progression if joined
      isCompleted:
        (Array.isArray(chapter.userProgress) &&
          chapter.userProgress[0]?.isCompleted) ||
        (typeof chapter.isCompleted === 'boolean'
          ? chapter.isCompleted
          : undefined),

      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
      deletedAt: chapter.deletedAt,
      publishedAt: chapter.publishedAt,
    };
  }
}

export class DocumentUploaderResponseDto {
  id: string;

  fullName: string;
  avatarUrl?: string;
  referenceId: string;
  verificationDate?: Date | null;
}

export class DocumentCategoryResponseDto {
  id: string;

  name: string;
  description?: string | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  constructor(partial: Partial<DocumentCategoryResponseDto>) {
    Object.assign(this, partial);
  }

  static fromCategory(category: any): DocumentCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt,
    };
  }
}

export class DocumentResponseDto {
  id: string;

  title: string;
  description?: string;
  categoryId: string;
  categoryName: string;
  slug?: string;
  downloads: number;
  thumbnailUrl: string;
  uploader: DocumentUploaderResponseDto;
  isPublished: boolean;

  chapters?: DocumentChapterResponseDto[];
  attachments?: DocumentAttachmentResponseDto[];

  userDocument: {
    isFollowing: boolean;
    isFavorite: boolean;
    lastViewed: Date;
  };

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  publishedAt?: Date;

  constructor(partial: Partial<DocumentResponseDto>) {
    Object.assign(this, partial);
  }

  static fromDocument(doc: any): DocumentResponseDto {
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      categoryId: doc.category.id,
      categoryName: doc.category.name,
      slug: doc.slug,
      downloads: doc.downloads,
      thumbnailUrl: doc.thumbnail?.fileUrl,
      isPublished: doc.isPublished,
      userDocument: doc.userDocuments,
      // Chapters
      chapters:
        doc.chapters?.map((chapter: any) =>
          DocumentChapterResponseDto.fromChapter(chapter),
        ) || [],
      // Attachments
      attachments:
        doc.attachments?.map((attachment: any) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          mimeType: attachment.mimeType,
        })) || [],
      // Uploader details
      uploader: {
        id: doc.uploader.id,
        fullName: doc.uploader.fullName,
        avatarUrl: doc.uploader.avatar?.fileUrl,
        referenceId: doc.uploader.referenceId,
        verificationDate: doc.uploader.verificationDate,
      },
      publishedAt: doc.publishedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      deletedAt: doc.deletedAt,
    };
  }
}

export class PaginatedDocumentResponseDto {
  data: DocumentResponseDto[];

  total: number;

  page: number;

  totalPages: number;

  // Transform method to convert from MongoDB document
  static fromPaginatedResult(result: any): PaginatedDocumentResponseDto {
    return {
      data: result.data,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }
}
