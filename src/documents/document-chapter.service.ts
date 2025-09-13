import Mux from '@mux/mux-node';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType } from '@prisma/client';
import { Cache } from 'cache-manager';
import { JwtPayload } from '../auth/jwt-payload';
import { AllConfigType } from '../common/configs/types/index.type';
import { PrismaService } from '../common/services/prisma.service';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { DocumentChapterUtil } from './document.util';
import { CreateDocumentChapterDto } from './dto/create-document.dto';
import { DocumentChapterResponseDto } from './dto/document-response.dto';
import { UpdateDocumentChapterDto } from './dto/update-document.dto';

@Injectable()
export class DocumentChapterService {
  private readonly logger = new Logger(DocumentChapterService.name);
  private readonly CACHE_TTL = 120 * 1000; // 2 minutes in milliseconds
  private readonly video: Mux.Video;

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly documentChapterUtil: DocumentChapterUtil,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    const muxConfig = this.configService.getOrThrow('mux', {
      infer: true,
    });

    if (!muxConfig) {
      throw new Error('Mux configuration is not set in environment variables');
    }
    const { video } = new Mux({
      tokenId: muxConfig.muxTokenId,
      tokenSecret: muxConfig.muxTokenSecret,
    });
    this.video = video;
  }

  async findChapterByid(
    documentId: string,
    chapterId: string,
  ): Promise<DocumentChapterResponseDto> {
    try {
      const cacheKey = `documentChapter:${documentId}:${chapterId}`;

      const existingChapter = await this.prisma.documentChapter.findUnique({
        where: { id: chapterId, documentId, deletedAt: null },
        include: { muxData: true },
      });

      if (!existingChapter) {
        this.logger.warn(
          `Chapter with ID "${chapterId}" for document "${documentId}" does not exist`,
        );
        throw new BadRequestException('Chapter does not exist');
      }

      // Cache the chapter for quick retrieval
      await this.cacheManager.set(cacheKey, existingChapter, this.CACHE_TTL);
      this.logger.log(
        `Chapter with ID "${chapterId}" for document "${documentId}" fetched successfully`,
      );

      return DocumentChapterResponseDto.fromChapter(existingChapter);
    } catch (error) {
      this.logger.error(
        `Error in documents - findChapterById method: ${error.message}`,
        error.stack,
      );

      throw new Error('Failed to fetch chapter by ID');
    }
  }

  async createChapter(
    documentId: string,
    dto: CreateDocumentChapterDto,
    user: JwtPayload,
  ): Promise<DocumentChapterResponseDto> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId, deletedAt: null },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const lastChapter = await this.prisma.documentChapter.findFirst({
        where: { documentId },
        orderBy: { position: 'desc' },
      });

      const newChapter = await this.prisma.documentChapter.create({
        data: {
          title: dto.title,
          isPublished: false, // Default to not published
          document: {
            connect: { id: documentId },
          },
          position: lastChapter ? lastChapter.position + 1 : 1, // Increment position
        },
      });

      // Invalidate cache for document chapters
      await this.cacheManager.del(`document:${documentId}`);

      this.logger.log(
        `Chapter "${dto.title}" created successfully for document ${documentId} by user ${user.id}`,
      );

      // Log activity
      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        ActivityType.DOCUMENT_CHAPTER_CREATED,
        user,
        `Created chapter "${dto.title}" for document "${existingDocument.title}"`,
        {
          newChapter: {
            id: newChapter.id,
            title: newChapter.title,
            position: newChapter.position,
            isPublished: newChapter.isPublished,
          },
        },
      );

      // Invalidate cache for the specific chapter
      await this.cacheManager.del(
        `documentChapter:${documentId}:${newChapter.id}`,
      );

      return DocumentChapterResponseDto.fromChapter(newChapter);
    } catch (error) {
      this.logger.error(
        `Error in documents - createChapter method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to create document chapter');
    }
  }

  async updateChapter(
    documentId: string,
    chapterId: string,
    dto: UpdateDocumentChapterDto,
    user: JwtPayload,
  ): Promise<DocumentChapterResponseDto> {
    try {
      // Step 1: Prepare non-DB work and validation
      const [existingDocument, existingChapter, existingUser] =
        await Promise.all([
          this.prisma.document.findUnique({ where: { id: documentId } }),
          this.prisma.documentChapter.findUnique({
            where: { id: chapterId, documentId },
          }),
          this.prisma.user.findUnique({ where: { id: user.id } }),
        ]);

      if (!existingDocument)
        throw new BadRequestException('Document does not exist');
      if (!existingChapter)
        throw new BadRequestException('Chapter does not exist');
      if (!existingUser) throw new BadRequestException('User does not exist');

      // Track changes as before...
      const changes: Record<string, any> = {};
      let activityType: ActivityType = ActivityType.DOCUMENT_CHAPTER_UPDATED;
      let activityDescription = `Updated chapter #${existingChapter.title} for document #${existingDocument.title} by ${existingUser.fullName}`;

      // Track title/content/views changes...
      let result = this.documentChapterUtil.trackTitleChange(
        existingChapter,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = result.activityType;
      activityDescription = result.activityDescription;

      result = this.documentChapterUtil.trackContentChange(
        existingChapter,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = result.activityType;
      activityDescription = result.activityDescription;

      result = this.documentChapterUtil.trackViewsChange(
        existingChapter,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = result.activityType;
      activityDescription = result.activityDescription;

      /** Published At Changes */

      result = this.documentChapterUtil.trackPublishedAtChange(
        existingChapter,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = result.activityType;
      activityDescription = result.activityDescription;

      // Step 2: Handle video (external API) BEFORE transaction
      let muxDataOp: { assetId?: string; playbackId?: string } | undefined =
        undefined;
      if (dto.videoUrl) {
        const existingMux = await this.prisma.muxData.findUnique({
          where: { documentChapterId: chapterId },
        });
        // Delete old video in external service if it exists
        if (existingMux) {
          await this.video.assets.delete(existingMux.assetId);
        }
        // Create new asset via external service
        const asset = await this.video.assets.create({
          inputs: [{ url: dto.videoUrl, type: 'video' }],
          playback_policies: ['public'],
          test: false,
          passthrough: `document-chapter:${chapterId}`,
        });

        muxDataOp = {
          assetId: asset.id,
          playbackId: asset.playback_ids?.[0].id,
        };
      }

      if (dto.videoUrl && !muxDataOp) {
        this.logger.warn(
          `Failed to create Mux asset for chapter "${chapterId}" of document "${documentId}"`,
        );
        throw new BadRequestException('Failed to create video asset');
      }

      // Step 3: Run all DB changes in a transaction
      const updatedChapter = await this.prisma.$transaction(async (tx) => {
        // If there is new muxData, delete and create as necessary
        if (dto.videoUrl) {
          // Delete old MuxData if any
          await tx.muxData.deleteMany({
            where: { documentChapterId: chapterId },
          });
          // Create new MuxData record
          await tx.muxData.create({
            data: {
              assetId: muxDataOp!.assetId!,
              documentChapterId: chapterId,
              playbackId: muxDataOp!.playbackId,
            },
          });
        }

        // Update chapter
        const chapter = await tx.documentChapter.update({
          where: { id: chapterId, documentId },
          data: {
            title: dto.title || existingChapter.title,
            content: dto.content || existingChapter.content,
            views: dto.views !== undefined ? dto.views : existingChapter.views,
            videoUrl: dto.videoUrl || existingChapter.videoUrl,
            publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
          },
        });

        // Invalidate cache (move this out if your cache is not DB-backed)
        await this.cacheManager.del(`document:${documentId}`);

        // Log activity (optional: move out if not critical)
        await this.activityLogService.createActivityLog(
          documentId,
          'DOCUMENT',
          activityType,
          user,
          activityDescription,
          changes,
        );

        return chapter;
      });

      this.logger.log(
        `Chapter with ID "${chapterId}" for document with ID "${documentId}" updated successfully by user ${user.id}`,
      );

      return DocumentChapterResponseDto.fromChapter(updatedChapter);
    } catch (error) {
      this.logger.error(
        `Error in documents - updateChapter method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to update document chapter');
    }
  }

  async deleteChapter(
    documentId: string,
    chapterId: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const existingChapter = await this.prisma.documentChapter.findUnique({
        where: { id: chapterId, documentId },
      });

      if (!existingChapter) {
        this.logger.warn(
          `Chapter with ID "${chapterId}" for document "${documentId}" does not exist`,
        );
        throw new BadRequestException('Chapter does not exist');
      }

      await this.prisma.documentChapter.update({
        where: { id: existingChapter.id, documentId },
        data: {
          deletedAt: new Date(),
        },
      });

      if (existingChapter.videoUrl) {
        // If the chapter has a video, delete it from Mux
        const existingMuxData = await this.prisma.muxData.findUnique({
          where: { documentChapterId: existingChapter.id },
        });

        if (existingMuxData) {
          try {
            await this.video.assets.delete(existingMuxData.assetId);
            this.logger.log(
              `Deleted Mux asset with ID "${existingMuxData.assetId}" for chapter "${existingChapter.title}"`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to delete Mux asset: ${error.message}`,
              error.stack,
            );
          }

          // Also delete the Mux data record
          await this.prisma.muxData.delete({
            where: { documentChapterId: existingChapter.id },
          });
          this.logger.log(
            `Deleted Mux data for chapter "${existingChapter.title}"`,
          );
        }
      }

      // Check document if none of the chapters are published then set document to unpublished
      const chapters = await this.prisma.documentChapter.findMany({
        where: { documentId, deletedAt: null },
      });

      const isAnyChapterPublished = chapters.some(
        (chapter) => chapter.isPublished,
      );

      if (!isAnyChapterPublished) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { isPublished: false }, // Set document to draft if no chapters are published
        });
        this.logger.log(
          `Document with ID "${documentId}" set to DRAFT status as all chapters are unpublished`,
        );
      }

      // Log activity
      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        ActivityType.DOCUMENT_CHAPTER_DELETED,
        user,
        `Deleted chapter "${existingChapter.title}" for document #${existingDocument.title}`,
        { chapterId: existingChapter.id },
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${documentId}`);

      this.logger.log(
        `Chapter "${existingChapter.title}" deleted successfully for document with ID "${documentId}" by user ${user.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - deleteChapter method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to delete document chapter');
    }
  }

  async bulkOrderChapters(
    documentId: string,
    updateData: { id: string; position: number }[],
    user: JwtPayload,
  ): Promise<DocumentChapterResponseDto[]> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId, deletedAt: null },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const chapters = await this.prisma.documentChapter.findMany({
        where: { documentId },
      });

      if (updateData.length !== chapters.length) {
        this.logger.warn(
          `Mismatch in number of chapters to update for document "${documentId}"`,
        );
        throw new BadRequestException('Invalid chapter data provided');
      }

      const updatedChapters = await this.prisma.$transaction(
        updateData.map((data) =>
          this.prisma.documentChapter.update({
            where: { id: data.id },
            data: { position: 5 },
          }),
        ),
      );

      // Log activity
      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        ActivityType.DOCUMENT_CHAPTER_ORDER_CHANGED,
        user,
        `Reordered chapters for document #${existingDocument.title}`,
        {
          updatedChapters: updatedChapters.map((chapter) => ({
            id: chapter.id,
            position: chapter.position,
          })),
        },
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${documentId}`);

      this.logger.log(
        `Chapters reordered successfully for document with ID "${documentId}" by user ${user.id}`,
      );

      return updatedChapters.map((chapter) =>
        DocumentChapterResponseDto.fromChapter(chapter),
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - bulkOrderChapters method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to reorder document chapters');
    }
  }

  async publishChapter(
    documentId: string,
    chapterId: string,
    user: JwtPayload,
    isPublished: boolean,
  ): Promise<DocumentChapterResponseDto> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId, deletedAt: null },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const existingChapter = await this.prisma.documentChapter.findUnique({
        where: { id: chapterId, documentId, deletedAt: null },
      });

      if (!existingChapter) {
        this.logger.warn(
          `Chapter with ID "${chapterId}" for document "${documentId}" does not exist`,
        );
        throw new BadRequestException('Chapter does not exist');
      }

      if (isPublished && (!existingChapter.title || !existingChapter.content)) {
        this.logger.warn(
          `Chapter "${existingChapter.title}" for document "${documentId}" is missing required fields`,
        );
        throw new BadRequestException(
          'Chapter must have a title and content to be published',
        );
      }

      const updatedChapter = await this.prisma.documentChapter.update({
        where: { id: chapterId, documentId },
        data: { isPublished, publishedAt: isPublished ? new Date() : null },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        ActivityType.DOCUMENT_CHAPTER_PUBLISH_CHANGED,
        user,
        `Published chapter "${updatedChapter.title}" for document #${existingDocument.title}`,
        { chapterId: updatedChapter.id },
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${documentId}`);

      this.logger.log(
        `Chapter "${updatedChapter.title}" published successfully for document with ID "${documentId}" by user ${user.id}`,
      );

      return DocumentChapterResponseDto.fromChapter(updatedChapter);
    } catch (error) {
      this.logger.error(
        `Error in documents - publishChapter method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to publish document chapter');
    }
  }

  async incrementChapterViews(
    documentId: string,
    chapterId: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId, deletedAt: null },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const existingChapter = await this.prisma.documentChapter.findUnique({
        where: { id: chapterId, documentId, deletedAt: null },
      });

      if (!existingChapter) {
        this.logger.warn(
          `Chapter with ID "${chapterId}" for document "${documentId}" does not exist`,
        );
        throw new BadRequestException('Chapter does not exist');
      }

      await this.prisma.documentChapter.update({
        where: { id: chapterId, documentId },
        data: { views: existingChapter.views + 1 },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        ActivityType.DOCUMENT_CHAPTER_VIEWS_CHANGED,
        user,
        `Incremented views for chapter "${existingChapter.title}" of document #${existingDocument.title}`,
        { chapterId: existingChapter.id },
      );

      this.logger.log(
        `Views incremented for chapter "${existingChapter.title}" of document with ID "${documentId}" by user ${user.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - incrementChapterViews method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to increment chapter views');
    }
  }

  async toggleUserCompleteChapter(
    documentId: string,
    chapterId: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      const existingChapter = await this.prisma.documentChapter.findUnique({
        where: { id: chapterId, documentId, deletedAt: null },
      });

      if (!existingChapter) {
        this.logger.warn(
          `Chapter with ID "${chapterId}" for document "${documentId}" does not exist`,
        );
        throw new BadRequestException('Chapter does not exist');
      }

      // Toggle completion status
      const userCompletion = await this.prisma.userDocumentProgress.findFirst({
        where: { documentChapterId: chapterId, userId: user.id },
      });

      if (userCompletion) {
        // If already completed, delete the record
        await this.prisma.userDocumentProgress.delete({
          where: { id: userCompletion.id },
        });
        this.logger.log(
          `User ${user.id} marked chapter "${existingChapter.title}" as incomplete`,
        );
      } else {
        // If not completed, create a new record
        await this.prisma.userDocumentProgress.create({
          data: {
            documentChapterId: chapterId,
            userId: user.id,
            isCompleted: true,
          },
        });
        this.logger.log(
          `User ${user.id} marked chapter "${existingChapter.title}" as complete`,
        );
      }

      // Log activity
      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        ActivityType.DOCUMENT_CHAPTER_USER_COMPLETED,
        user,
        `User ${user.id} toggled completion status for chapter "${existingChapter.title}" of document #${documentId}`,
        { chapterId: existingChapter.id },
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - toggleUserCompleteChapter method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to toggle user chapter completion');
    }
  }
}
