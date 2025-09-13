import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Document, DocumentChapter } from '@prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import {
  UpdateDocumentChapterDto,
  UpdateDocumentDto,
} from './dto/update-document.dto';

interface TrackChangesResponse {
  activityType: ActivityType;
  activityDescription: string;
}

@Injectable()
export class DocumentUtil {
  /**
   *
   */
  constructor(private readonly prisma: PrismaService) {}

  trackTitleChange(
    document: Document,
    dto: UpdateDocumentDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.title !== undefined && document.title !== dto.title) {
      changes.oldName = document.title;
      changes.newName = dto.title;
      activityType = ActivityType.DOCUMENT_TITLE_CHANGED;
      activityDescription = `Renamed document from "${document.title || `Unnamed Document`}" to "${dto.title}"`;
      document.title = dto.title;
    }

    return { activityType, activityDescription };
  }

  trackDescriptionChange(
    document: Document,
    dto: UpdateDocumentDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (
      dto.description !== undefined &&
      document.description !== dto.description
    ) {
      changes.oldDescription = document.description;
      changes.newDescription = dto.description;
      activityType = ActivityType.DOCUMENT_DESCRIPTION_CHANGED;
      activityDescription = `Updated document description from "${document.description || 'No description'}" to "${dto.description}"`;
      document.description = dto.description;
    }

    return { activityType, activityDescription };
  }

  trackSlugChange(
    document: Document,
    dto: UpdateDocumentDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.slug !== undefined && document.slug !== dto.slug) {
      changes.oldSlug = document.slug;
      changes.newSlug = dto.slug;
      activityType = ActivityType.DOCUMENT_SLUG_CHANGED;
      activityDescription = `Updated document slug from "${document.slug || 'No slug'}" to "${dto.slug}"`;
      document.slug = dto.slug;
    }

    return { activityType, activityDescription };
  }

  trackDownloadsChange(
    document: Document,
    dto: UpdateDocumentDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.downloads !== undefined && document.downloads !== dto.downloads) {
      changes.oldDownloads = document.downloads;
      changes.newDownloads = dto.downloads;
      activityType = ActivityType.DOCUMENT_DOWNLOADS_CHANGED;
      activityDescription = `Updated document downloads from ${document.downloads} to ${dto.downloads}`;
      document.downloads = dto.downloads;
    }

    return { activityType, activityDescription };
  }

  async trackCategoryChange(
    document: Document,
    dto: UpdateDocumentDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): Promise<TrackChangesResponse> {
    if (
      dto.categoryId !== undefined &&
      document.categoryId !== dto.categoryId
    ) {
      // Fetch old and new category names
      const oldCategory = document.categoryId
        ? await this.prisma.documentCategory.findUnique({
            where: { id: document.categoryId },
          })
        : null;
      const newCategory = dto.categoryId
        ? await this.prisma.documentCategory.findUnique({
            where: { id: dto.categoryId },
          })
        : null;

      if (!oldCategory) {
        throw new NotFoundException(
          `Old category with ID ${document.categoryId} not found`,
        );
      }

      if (!newCategory) {
        throw new NotFoundException(
          `New category with ID ${dto.categoryId} not found`,
        );
      }

      changes.oldCategoryId = document.categoryId;
      changes.newCategoryId = dto.categoryId;
      activityType = ActivityType.DOCUMENT_CATEGORY_CHANGED;
      activityDescription = `Updated document category from "${oldCategory?.name || 'No category'}" to "${newCategory?.name || 'No category'}"`;
      document.categoryId = dto.categoryId;
    }

    return { activityType, activityDescription };
  }

  trackPublishedAtChange(
    document: Document,
    dto: UpdateDocumentDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (
      dto.publishedAt !== undefined &&
      document.publishedAt !== new Date(dto.publishedAt)
    ) {
      changes.oldPublishedAt = document.publishedAt;
      changes.newPublishedAt = dto.publishedAt;
      activityType = ActivityType.DOCUMENT_PUBLISHED_AT_CHANGED;
      activityDescription = `Updated document published at from "${document.publishedAt || 'No published at'}" to "${dto.publishedAt}"`;
      document.publishedAt = new Date(dto.publishedAt);
    }

    return { activityType, activityDescription };
  }
}

@Injectable()
export class DocumentChapterUtil {
  /**
   *
   */
  trackTitleChange(
    chapter: DocumentChapter,
    dto: UpdateDocumentChapterDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.title !== undefined && chapter.title !== dto.title) {
      changes.oldTitle = chapter.title;
      changes.newTitle = dto.title;
      activityType = ActivityType.DOCUMENT_CHAPTER_TITLE_CHANGED;
      activityDescription = `Renamed chapter from "${chapter.title || `Unnamed Document Chapter`}" to "${dto.title}"`;
      chapter.title = dto.title;
    }

    return { activityType, activityDescription };
  }

  trackContentChange(
    chapter: DocumentChapter,
    dto: UpdateDocumentChapterDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.content !== undefined && chapter.content !== dto.content) {
      changes.oldContent = chapter.content;
      changes.newContent = dto.content;
      activityType = ActivityType.DOCUMENT_CHAPTER_CONTENT_CHANGED;
      activityDescription = `Updated chapter content from "${chapter.content || 'No content'}" to "${dto.content}"`;
      chapter.content = dto.content;
    }

    return { activityType, activityDescription };
  }

  trackViewsChange(
    chapter: DocumentChapter,
    dto: UpdateDocumentChapterDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.views !== undefined && chapter.views !== dto.views) {
      changes.oldViews = chapter.views;
      changes.newViews = dto.views;
      activityType = ActivityType.DOCUMENT_CHAPTER_VIEWS_CHANGED;
      activityDescription = `Updated chapter views from ${chapter.views} to ${dto.views}`;
      chapter.views = dto.views;
    }

    return { activityType, activityDescription };
  }

  trackVideoUrlChange(
    chapter: DocumentChapter,
    dto: UpdateDocumentChapterDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (dto.videoUrl !== undefined && chapter.videoUrl !== dto.videoUrl) {
      changes.oldVideoUrl = chapter.videoUrl;
      changes.newVideoUrl = dto.videoUrl;
      activityType = ActivityType.DOCUMENT_CHAPTER_VIDEO_CHANGED;
      activityDescription = `Updated chapter video URL from "${chapter.videoUrl || 'No video URL'}" to "${dto.videoUrl}"`;
      chapter.videoUrl = dto.videoUrl;
    }

    return { activityType, activityDescription };
  }

  trackPublishedAtChange(
    chapter: DocumentChapter,
    dto: UpdateDocumentChapterDto,
    changes: Record<string, any>,
    activityType: ActivityType,
    activityDescription: string,
  ): TrackChangesResponse {
    if (
      dto.publishedAt !== undefined &&
      chapter.publishedAt !== new Date(dto.publishedAt)
    ) {
      changes.oldPublishedAt = chapter.publishedAt;
      changes.newPublishedAt = dto.publishedAt;
      activityType = ActivityType.DOCUMENT_CHAPTER_PUBLISHED_AT_CHANGED;
      activityDescription = `Updated chapter published at from "${chapter.publishedAt || 'No published at'}" to "${dto.publishedAt}"`;
      chapter.publishedAt = new Date(dto.publishedAt);
    }

    return { activityType, activityDescription };
  }
}
