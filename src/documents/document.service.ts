import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ActivityType, Prisma, UserStatus } from '@prisma/client';
import { Cache } from 'cache-manager';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../common/services/prisma.service';
import { messages } from '../constants/messages';
import { DocumentUtil } from './document.util';
import {
  CreateDocumentCategoryDto,
  CreateDocumentDto,
} from './dto/create-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import {
  DocumentAttachmentResponseDto,
  DocumentCategoryResponseDto,
  DocumentResponseDto,
  PaginatedDocumentResponseDto,
} from './dto/document-response.dto';
import {
  ChapterWithProgressDto,
  PaginatedUserDocumentWithProgressResponseDto,
  UserDocumentWithProgressResponseDto,
} from './dto/document-user-response.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { CreateDocumentCommentDto } from './dto/create-comment.dto';
import { UpdateDocumentCommentDto } from './dto/update-comment.dto';
import { DocumentCommentQueryDto } from './dto/document-comment-query.dto';
import { DocumentCommentResponseDto } from './dto/document-comment-response.dto';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly CACHE_TTL = 120 * 1000; // 2 minutes in milliseconds

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly documentUtil: DocumentUtil,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(
    query: DocumentQueryDto = {},
    user: JwtPayload,
  ): Promise<PaginatedDocumentResponseDto> {
    try {
      const cacheKey = `documents:${JSON.stringify(query)}`;
      const cachedData =
        await this.cacheManager.get<PaginatedDocumentResponseDto>(cacheKey);
      if (cachedData) return cachedData;

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.DocumentWhereInput = {
        ...(query.showAll ? {} : { isPublished: true }),
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.referenceId && { referenceId: query.referenceId }),
        ...(query.uploaderId && { uploaderId: query.uploaderId }),
        ...(query.searchQuery && {
          OR: [
            {
              title: {
                contains: query.searchQuery,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              slug: {
                contains: query.searchQuery,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }),
        deletedAt: null, // Only include non-deleted documents
      };

      const orderBy: Prisma.DocumentOrderByWithRelationInput = (() => {
        switch (query.mode) {
          case 'downloads':
            return { downloads: Prisma.SortOrder.desc };
          case 'views':
            return { views: Prisma.SortOrder.desc };
          case 'latest':
          default:
            return { publishedAt: Prisma.SortOrder.desc };
        }
      })();

      const documents = await this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          chapters: {
            where: { deletedAt: null }, // Only include non-deleted chapters
            orderBy: { position: Prisma.SortOrder.asc },
            include: {
              userProgress: {
                where: { userId: user.id },
                select: {
                  isCompleted: true,
                },
              },
            },
          },
          attachments: {
            where: { deletedAt: null }, // Only include non-deleted attachments
            select: {
              id: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              deletedAt: true,
            },
          },
          uploader: {
            select: {
              id: true,
              fullName: true,
              referenceId: true,
              verificationDate: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
            },
          },
          thumbnail: {
            select: {
              fileUrl: true,
            },
          },
          userDocuments: {
            where: { userId: user.id },
            select: {
              isFollowing: true,
              isFavorite: true,
              lastViewed: true,
            },
          },
        },
      });

      // Filter out documents where category is deleted (category.deletedAt !== null)
      // Filter out documents where category is deleted (category.deletedAt !== null)
      let filteredDocuments = documents.filter(
        (doc) => doc.category.deletedAt === null,
      );

      if (query.favoriteOnly) {
        filteredDocuments = filteredDocuments.filter(
          (doc) => Boolean(doc.userDocuments?.[0]?.isFavorite) === true,
        );
      }
      if (query.followingOnly) {
        filteredDocuments = filteredDocuments.filter(
          (doc) => Boolean(doc.userDocuments?.[0]?.isFollowing) === true,
        );
      }

      const mappedDocuments = filteredDocuments.map((doc) =>
        DocumentResponseDto.fromDocument(doc),
      );

      const paginatedResponse =
        PaginatedDocumentResponseDto.fromPaginatedResult({
          data: mappedDocuments,
          total: mappedDocuments.length,
          page,
          totalPages: Math.ceil(mappedDocuments.length / limit),
        });

      await this.cacheManager.set(cacheKey, paginatedResponse, this.CACHE_TTL);

      return paginatedResponse;
    } catch (error) {
      this.logger.error(
        `Error in documents - findAll method: ${error.message}`,
        error.stack,
      );

      throw new Error('Failed to fetch documents');
    }
  }

  async findAllDocumentsByUser(
    user: JwtPayload,
    query: DocumentQueryDto = {},
  ): Promise<PaginatedUserDocumentWithProgressResponseDto> {
    try {
      const cacheKey = `userDocuments:${user.id}:${JSON.stringify(query)}`;
      const cachedData =
        await this.cacheManager.get<PaginatedUserDocumentWithProgressResponseDto>(
          cacheKey,
        );
      if (cachedData) return cachedData;

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.DocumentWhereInput = {
        deletedAt: null,
        isPublished: true,
        // Remove uploaderId filter to show all published documents with user progress
        ...(query.categoryId && { categoryId: query.categoryId }),
        ...(query.searchQuery && {
          OR: [
            {
              title: {
                contains: query.searchQuery,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              slug: {
                contains: query.searchQuery,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }),
      };

      const orderBy: Prisma.DocumentOrderByWithRelationInput = {
        createdAt: Prisma.SortOrder.desc,
      };

      const [documents, total] = await Promise.all([
        this.prisma.document.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            userDocuments: {
              where: { userId: user.id },
              select: {
                isFollowing: true,
                isFavorite: true,
                lastViewed: true,
              },
            },
            chapters: {
              where: { deletedAt: null },
              orderBy: { position: Prisma.SortOrder.asc },
              include: {
                userProgress: {
                  where: { userId: user.id },
                  select: { isCompleted: true },
                },
                muxData: true,
              },
            },
            attachments: {
              where: { deletedAt: null },
              select: {
                id: true,
                fileUrl: true,
                fileName: true,
                mimeType: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                deletedAt: true,
              },
            },
            uploader: {
              select: {
                id: true,
                fullName: true,
                referenceId: true,
                verificationDate: true,
                avatar: {
                  select: {
                    fileUrl: true,
                  },
                },
              },
            },
            thumbnail: {
              select: {
                fileUrl: true,
              },
            },
          },
        }),
        this.prisma.document.count({ where }),
      ]);

      const filteredDocuments = documents
        .filter((doc) => doc.category.deletedAt === null)
        .map((doc) => {
          const userDoc = doc.userDocuments[0] || {};

          // Use DTO mapping method
          return UserDocumentWithProgressResponseDto.fromDocumentWithProgress(
            {
              ...doc,
              category: {
                id: doc.category.id,
                name: doc.category.name,
              },
              uploader: {
                id: doc.uploader.id,
                fullName: doc.uploader.fullName,
                referenceId: doc.uploader.referenceId,
                avatarUrl: doc.uploader.avatar?.fileUrl || null,
                verificationDate: doc.uploader.verificationDate || null,
              },
              thumbnailUrl: doc.thumbnail?.fileUrl || null,
              attachments: doc.attachments,
              chapters: doc.chapters.map((chapter) =>
                ChapterWithProgressDto.fromChapter({
                  ...chapter,
                  isCompleted: chapter.userProgress[0]?.isCompleted ?? false,
                }),
              ),
            },
            Boolean(userDoc.isFollowing),
            Boolean(userDoc.isFavorite),
            userDoc.lastViewed ?? false,
          );
        });

      const paginatedResponse =
        PaginatedUserDocumentWithProgressResponseDto.fromPaginatedResult({
          data: filteredDocuments,
          total,
          page,
          totalPages: Math.ceil(total / limit),
        });

      await this.cacheManager.set(cacheKey, paginatedResponse, this.CACHE_TTL);

      return paginatedResponse;
    } catch (error) {
      this.logger.error(
        `Error in documents - findAllDocumentsByUser method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to fetch user documents');
    }
  }

  async findAllCategories(): Promise<DocumentCategoryResponseDto[]> {
    try {
      const cacheKey = 'documentCategories';
      const cachedCategories =
        await this.cacheManager.get<DocumentCategoryResponseDto[]>(cacheKey);
      if (cachedCategories) return cachedCategories;

      const categories = await this.prisma.documentCategory.findMany({
        where: { deletedAt: null }, // Only include non-deleted categories
        orderBy: { name: 'asc' }, // Order categories by name
      });

      const response = categories.map(
        (category) => new DocumentCategoryResponseDto(category),
      );

      await this.cacheManager.set(cacheKey, response, this.CACHE_TTL);

      return response;
    } catch (error) {
      this.logger.error(
        `Error in documents - findAllCategories method: ${error.message}`,
        error.stack,
      );

      throw new Error('Failed to fetch document categories');
    }
  }

  async findOne(id: string): Promise<DocumentResponseDto> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id, deletedAt: null },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const cacheKey = `document:${id}`;
      const cachedDocument =
        await this.cacheManager.get<DocumentResponseDto>(cacheKey);
      if (cachedDocument) return cachedDocument;

      const document = await this.prisma.document.findUnique({
        where: { id },
        include: {
          chapters: {
            where: {
              deletedAt: null, // Only include non-deleted chapters
            },
            orderBy: {
              position: 'asc', // Order chapters by position
            },
          },
          attachments: {
            where: {
              deletedAt: null, // Only include non-deleted attachments
            },
            select: {
              id: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              deletedAt: true, // Exclude deletedAt from response
            },
          },
          uploader: {
            select: {
              id: true,
              fullName: true,
              referenceId: true,
              verificationDate: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
            },
          },
          thumbnail: {
            select: {
              fileUrl: true,
            },
          },
        },
      });

      return DocumentResponseDto.fromDocument(document);
    } catch (error) {
      this.logger.error(
        `Error in documents - findById method: ${error.message}`,
        error.stack,
      );

      throw new Error('Failed to fetch document by ID');
    }
  }

  async create(
    dto: CreateDocumentDto,
    user: JwtPayload,
  ): Promise<DocumentResponseDto> {
    try {
      const existingCategory = await this.prisma.documentCategory.findUnique({
        where: { id: dto.categoryId },
      });

      if (!existingCategory) {
        this.logger.warn(`Category with ID "${dto.categoryId}" does not exist`);

        throw new BadRequestException('Category does not exist');
      }

      const existingDocs = await this.prisma.document.findMany({
        where: {
          title: dto.title,
          categoryId: dto.categoryId,
        },
      });

      if (existingDocs.length > 0) {
        this.logger.warn(
          `Document with title "${dto.title}" already exists in category "${dto.categoryId}"`,
        );

        throw new BadRequestException(
          messages.duplicateDocumentWithSameNameAndCategory,
        );
      }

      const documentData: Prisma.DocumentCreateInput = {
        title: dto.title,
        description: dto.description,
        slug: dto.slug,
        category: {
          connect: { id: dto.categoryId },
        },
        uploader: {
          connect: { id: user.id },
        },
      };

      const createdDocument = await this.prisma.document.create({
        data: {
          ...documentData,
          isPublished: false, // Default to not published
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          uploader: {
            select: {
              id: true,
              fullName: true,
              referenceId: true,
              verificationDate: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
            },
          },
          thumbnail: {
            select: {
              fileUrl: true,
            },
          },
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        createdDocument.id,
        'DOCUMENT',
        ActivityType.DOCUMENT_CREATED,
        user,
        `Created document #${createdDocument.title}`,
      );

      const response = DocumentResponseDto.fromDocument(createdDocument);

      // Invalidate cache for documents
      await this.cacheManager.del('documents:*');

      return response;
    } catch (error) {
      this.logger.error(
        `Error in documents - create method: ${error.message}`,
        error.stack,
      );

      throw new Error('Failed to create document');
    }
  }

  async createCategory(
    dto: CreateDocumentCategoryDto,
    user: JwtPayload,
  ): Promise<DocumentCategoryResponseDto> {
    try {
      const existingCategory = await this.prisma.documentCategory.findFirst({
        where: {
          name: dto.name,
        },
      });
      if (existingCategory) {
        this.logger.warn(`Category with name "${dto.name}" already exists`);
        throw new BadRequestException('Category already exists');
      }

      const newCategory = await this.prisma.documentCategory.create({
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      // Invalidate cache for document categories
      await this.cacheManager.del('documentCategories');

      this.logger.log(
        `Category "${dto.name}" created successfully by user ${user.id}`,
      );

      // TODO: Log activities

      return DocumentCategoryResponseDto.fromCategory(newCategory);
    } catch (error) {
      this.logger.error(
        `Error in documents - createCategory method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to create document category');
    }
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: JwtPayload,
  ): Promise<DocumentResponseDto> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const existingCategory = await this.prisma.documentCategory.findUnique({
        where: { id: existingDocument.categoryId },
      });

      if (!existingCategory) {
        this.logger.warn(`Category with ID "${dto.categoryId}" does not exist`);
        throw new BadRequestException('Category does not exist');
      }

      if (dto.categoryId && dto.categoryId !== existingDocument.categoryId) {
        const categoryExists = await this.prisma.documentCategory.findUnique({
          where: { id: dto.categoryId },
        });

        if (!categoryExists) {
          this.logger.warn(
            `Category with ID "${dto.categoryId}" does not exist`,
          );
          throw new BadRequestException('Category does not exist');
        }
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!existingUser) {
        this.logger.warn(`User with ID "${user.id}" does not exist`);
        throw new BadRequestException('User does not exist');
      }

      const changes: Record<string, any> = {};
      let activityType: ActivityType = ActivityType.DOCUMENT_UPDATED;
      let activityDescription = `Updated ticket #${existingDocument.title} by ${existingUser.fullName}`;

      // Track changes
      /** Name Changes */
      const nameChanges = this.documentUtil.trackTitleChange(
        existingDocument,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = nameChanges.activityType;
      activityDescription = nameChanges.activityDescription;

      /** Description Changes */
      const descriptionChanges = this.documentUtil.trackDescriptionChange(
        existingDocument,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = descriptionChanges.activityType;
      activityDescription = descriptionChanges.activityDescription;

      /** Slug Changes */
      const slugChanges = this.documentUtil.trackSlugChange(
        existingDocument,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = slugChanges.activityType;
      activityDescription = slugChanges.activityDescription;

      /** Downloads Changes */
      const downloadsChanges = this.documentUtil.trackDownloadsChange(
        existingDocument,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = downloadsChanges.activityType;
      activityDescription = downloadsChanges.activityDescription;

      /** Category Changes */
      const categoryChanges = await this.documentUtil.trackCategoryChange(
        existingDocument,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = categoryChanges.activityType;
      activityDescription = categoryChanges.activityDescription;

      /** Published At Changes */
      const publishedAtChanges = this.documentUtil.trackPublishedAtChange(
        existingDocument,
        dto,
        changes,
        activityType,
        activityDescription,
      );
      activityType = publishedAtChanges.activityType;
      activityDescription = publishedAtChanges.activityDescription;

      // Save changes
      const updatedDocument = await this.prisma.document.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          slug: dto.slug,
          downloads: dto.downloads,
          category: {
            connect: { id: dto.categoryId || existingDocument.categoryId },
          },
          publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          uploader: {
            select: {
              id: true,
              fullName: true,
              referenceId: true,
              verificationDate: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
            },
          },
          thumbnail: {
            select: {
              fileUrl: true,
            },
          },
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        updatedDocument.id,
        'DOCUMENT',
        activityType,
        user,
        activityDescription,
        changes,
      );

      // Invalidate cache for documents
      await this.cacheManager.del(`document:${id}`);
      await this.cacheManager.del('documents:*');

      this.logger.log(
        `Document with ID "${id}" updated successfully by user ${user.id}`,
      );

      return DocumentResponseDto.fromDocument(updatedDocument);
    } catch (error) {
      this.logger.error(
        `Error in documents - update method: ${error.message}`,
        error.stack,
      );

      throw new Error('Failed to update document');
    }
  }

  async updateThumbnail(
    id: string,
    thumbnailUrl: string,
    user: JwtPayload,
  ): Promise<DocumentResponseDto> {
    try {
      // Find the existing document first (can be part of transaction too)
      const existingDocument = await this.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      let updatedDocument: any;
      await this.prisma.$transaction(async (tx) => {
        // 1. Create new attachment
        const newThumbnail = await tx.attachment.create({
          data: {
            fileUrl: thumbnailUrl,
            originalFileName: `thumbnail_${existingDocument.slug ? existingDocument.slug : existingDocument.title}.jpg`,
            mimeType: 'image',
            fileName: `thumbnail_${
              existingDocument.slug
                ? existingDocument.slug
                : existingDocument.title
            }_${Date.now()}.jpg`,
          },
        });

        // 2. Update document with new thumbnail
        updatedDocument = await tx.document.update({
          where: { id },
          data: {
            thumbnail: {
              connect: { id: newThumbnail.id },
            },
          },
          include: {
            category: { select: { id: true, name: true } },
            uploader: {
              select: {
                id: true,
                fullName: true,
                referenceId: true,
                avatar: { select: { fileUrl: true } },
              },
            },
            thumbnail: { select: { fileUrl: true } },
          },
        });

        if (!updatedDocument || !updatedDocument.thumbnail) {
          throw new Error('Failed to update document thumbnail');
        }
      });

      // Out of transaction: Logging and cache invalidation
      await this.activityLogService.createActivityLog(
        updatedDocument.id,
        'DOCUMENT',
        ActivityType.DOCUMENT_UPDATED,
        user,
        `Updated thumbnail for document #${updatedDocument.title}`,
        { thumbnailUrl: updatedDocument.thumbnail.fileUrl },
      );

      await this.cacheManager.del(`document:${id}`);
      await this.cacheManager.del('documents:*');

      this.logger.log(
        `Thumbnail for document with ID "${id}" updated successfully by user ${user.id}`,
      );

      return DocumentResponseDto.fromDocument(updatedDocument);
    } catch (error) {
      this.logger.error(
        `Error in documents - updateThumbnail method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to update document thumbnail');
    }
  }

  async uploadAttachment(
    id: string,
    fileUrl: string,
    mimeType: string,
    user: JwtPayload,
  ): Promise<DocumentAttachmentResponseDto> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const existingAttachment = await this.prisma.attachment.findFirst({
        where: {
          fileUrl,
          documentId: id,
        },
      });

      if (existingAttachment) {
        this.logger.warn(
          `Attachment with URL "${fileUrl}" already exists for document "${id}"`,
        );
        throw new BadRequestException('Attachment already exists');
      }

      // Use slug if available, otherwise title (replace spaces with underscores)
      const baseName = existingDocument.slug
        ? existingDocument.slug
        : existingDocument.title.toLowerCase().replace(/\s+/g, '_');

      const originalFileName = `attachment_${baseName}`;

      const newAttachment = await this.prisma.attachment.create({
        data: {
          fileUrl,
          originalFileName,
          mimeType,
          fileName: `attachment_${baseName}_${Date.now()}`,
          documentAttachment: {
            connect: { id },
          },
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        id,
        'DOCUMENT',
        ActivityType.DOCUMENT_ATTACHMENT_ADDED,
        user,
        `Uploaded attachment "${originalFileName}" for document #${existingDocument.title}`,
        { attachmentId: newAttachment.id, fileUrl: newAttachment.fileUrl },
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${id}`);

      this.logger.log(
        `Attachment "${originalFileName}" uploaded successfully for document with ID "${id}" by user ${user.id}`,
      );

      return DocumentAttachmentResponseDto.fromAttachment(newAttachment);
    } catch (error) {
      this.logger.error(
        `Error in documents - uploadAttachment method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to upload document attachment');
    }
  }

  async delete(id: string, user: JwtPayload): Promise<void> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      await this.prisma.document.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        id,
        'DOCUMENT',
        ActivityType.DOCUMENT_DELETED,
        user,
        `Deleted document #${existingDocument.title}`,
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${id}`);

      this.logger.log(
        `Document with ID "${id}" deleted successfully by user ${user.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - delete method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to delete document');
    }
  }

  async deleteAttachment(
    id: string,
    attachmentId: string,
    user: JwtPayload,
  ): Promise<void> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const existingAttachment = await this.prisma.attachment.findUnique({
        where: { id: attachmentId },
      });

      if (!existingAttachment) {
        this.logger.warn(
          `Attachment with ID "${attachmentId}" does not exist for document "${id}"`,
        );
        throw new BadRequestException('Attachment does not exist');
      }

      await this.prisma.attachment.update({
        where: { id: attachmentId },
        data: {
          deletedAt: new Date(),
        },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        id,
        'DOCUMENT',
        ActivityType.DOCUMENT_ATTACHMENT_DELETED,
        user,
        `Deleted attachment "${existingAttachment.originalFileName}" for document #${existingDocument.title}`,
        { attachmentId: existingAttachment.id },
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${id}`);

      this.logger.log(
        `Attachment "${existingAttachment.originalFileName}" deleted successfully for document with ID "${id}" by user ${user.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - deleteAttachment method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to delete document attachment');
    }
  }

  async publishDocument(
    id: string,
    user: JwtPayload,
    isPublished: boolean,
  ): Promise<void> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id, deletedAt: null },
        include: {
          chapters: {
            where: { deletedAt: null }, // Only include non-deleted chapters
            select: {
              isPublished: true,
            },
          },
        },
      });

      if (!existingDocument) {
        this.logger.warn(`Document with ID "${id}" does not exist`);
        throw new BadRequestException('Document does not exist');
      }

      const hasPublishedChapters = existingDocument.chapters.some(
        (chapter) => chapter.isPublished,
      );

      if (isPublished) {
        if (
          !existingDocument.title ||
          !existingDocument.categoryId ||
          !existingDocument.uploaderId ||
          !hasPublishedChapters
        ) {
          this.logger.warn(
            `Document "${existingDocument.title}" is missing required fields`,
          );

          throw new BadRequestException(
            'Document must have a title and description to be published',
          );
        }
      }

      const updatedDocument = await this.prisma.document.update({
        where: { id },
        data: { isPublished, publishedAt: isPublished ? new Date() : null },
      });

      // Log activity
      await this.activityLogService.createActivityLog(
        id,
        'DOCUMENT',
        ActivityType.DOCUMENT_PUBLISH_CHANGED,
        user,
        `Published document #${updatedDocument.title}`,
        { isPublished },
      );

      // Invalidate cache for document
      await this.cacheManager.del(`document:${id}`);

      this.logger.log(
        `Document with ID "${id}" published successfully by user ${user.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error in documents - publishDocument method: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to publish document');
    }
  }

  // --- Document Comments ---

  async getDocumentComments(
    documentId: string,
    query: DocumentCommentQueryDto,
    userId: string,
  ): Promise<{
    data: DocumentCommentResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Get total count of root comments
      const totalRootComments = await this.prisma.documentComment.count({
        where: {
          documentId,
          parentId: null,
          deletedAt: null,
        },
      });

      const rootComments = await this.prisma.documentComment.findMany({
        where: {
          documentId,
          parentId: null,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
          likes: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                  referenceId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      });

      const data = rootComments.map((comment) =>
        DocumentCommentResponseDto.fromEntity(comment, userId),
      );

      const totalPages = Math.ceil(totalRootComments / limit);

      return {
        data,
        total: totalRootComments,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Error getting document comments: ', error);
      throw new InternalServerErrorException('Failed to get document comments');
    }
  }

  async getDocumentCommentReplies(
    documentId: string,
    commentId: string,
    query: DocumentCommentQueryDto,
    userId: string,
  ): Promise<{
    data: DocumentCommentResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Get total count of replies
      const totalReplies = await this.prisma.documentComment.count({
        where: {
          documentId,
          parentId: commentId,
          deletedAt: null,
        },
      });

      const replies = await this.prisma.documentComment.findMany({
        where: {
          documentId,
          parentId: commentId,
          deletedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
          likes: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  avatar: {
                    select: {
                      fileUrl: true,
                    },
                  },
                  referenceId: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: limit,
      });

      const data = replies.map((reply) =>
        DocumentCommentResponseDto.fromEntity(reply, userId),
      );

      const totalPages = Math.ceil(totalReplies / limit);

      return {
        data,
        total: totalReplies,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Error getting document comment replies: ', error);
      throw new InternalServerErrorException(
        'Failed to get document comment replies',
      );
    }
  }

  private async createDocumentCommentTransaction(
    tx: Prisma.TransactionClient,
    documentId: string,
    userId: string,
    commentDto: CreateDocumentCommentDto,
  ) {
    const comment = await tx.documentComment.create({
      data: {
        documentId,
        userId,
        content: commentDto.content,
        parentId: commentDto.parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatar: {
              select: {
                fileUrl: true,
              },
            },
            referenceId: true,
          },
        },
      },
    });

    return comment;
  }

  async addDocumentComment(
    documentId: string,
    userId: string,
    dto: CreateDocumentCommentDto,
  ): Promise<DocumentCommentResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }

      // Verify document exists
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const result = await this.prisma.$transaction((tx) =>
        this.createDocumentCommentTransaction(tx, documentId, userId, dto),
      );

      this.logger.log(
        `Document comment added successfully for document ${documentId} by user ${userId}`,
      );

      return DocumentCommentResponseDto.fromEntity(result, userId);
    } catch (error) {
      this.logger.error('Error adding document comment: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add document comment');
    }
  }

  async updateDocumentComment(
    commentId: string,
    userId: string,
    dto: UpdateDocumentCommentDto,
  ): Promise<DocumentCommentResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }

      const comment = await this.prisma.documentComment.update({
        where: { id: commentId, userId },
        data: { content: dto.content },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
              referenceId: true,
            },
          },
          likes: true,
        },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      this.logger.log(
        `Document comment updated successfully for comment ${commentId} by user ${userId}`,
      );

      return DocumentCommentResponseDto.fromEntity(comment, userId);
    } catch (error) {
      this.logger.error('Error updating document comment: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to update document comment',
      );
    }
  }

  async deleteDocumentComment(
    commentId: string,
    userId: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }

      const comment = await this.prisma.documentComment.delete({
        where: { id: commentId, userId },
      });

      if (!comment) {
        throw new NotFoundException('Comment not found');
      }

      this.logger.log(
        `Document comment deleted successfully for comment ${commentId} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error('Error deleting document comment: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to delete document comment',
      );
    }
  }

  private async handleDocumentCommentLike(
    commentId: string,
    userId: string,
    existing: any,
  ) {
    if (existing) {
      await this.prisma.documentCommentLike.delete({
        where: { commentId_userId: { commentId, userId } },
      });
      this.logger.log(
        `Document comment like deleted successfully for comment ${commentId} by user ${userId}`,
      );
      return { liked: false };
    }

    const newCommentLike = await this.prisma.documentCommentLike.create({
      data: { commentId, userId },
    });
    this.logger.log(
      `Document comment like created successfully for comment ${commentId} by user ${userId}`,
    );
    return { liked: true, commentLike: newCommentLike, userId };
  }

  async toggleDocumentCommentLike(
    commentId: string,
    userId: string,
  ): Promise<{ liked: boolean }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.status !== UserStatus.active) {
        throw new BadRequestException(messages.userNotActive);
      }

      const existing = await this.prisma.documentCommentLike.findUnique({
        where: { commentId_userId: { commentId, userId } },
      });

      return this.handleDocumentCommentLike(commentId, userId, existing);
    } catch (error) {
      this.logger.error('Error toggling document comment like: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to toggle document comment like',
      );
    }
  }

  // --- Favorites & Follows ---

  private async ensureUserDocument(documentId: string, userId: string) {
    const userDoc = await this.prisma.userDocument.findUnique({
      where: { userId_documentId: { userId, documentId } },
    });
    if (userDoc) return userDoc;
    return this.prisma.userDocument.create({
      data: {
        userId,
        documentId,
        isFavorite: false,
        isFollowing: false,
        lastViewed: false,
      },
    });
  }

  async toggleUserFavoriteDocument(
    documentId: string,
    user: JwtPayload,
  ): Promise<{ isFavorite: boolean }> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId, deletedAt: null },
        select: { id: true, title: true },
      });
      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new NotFoundException('Document not found');
      }

      const userDoc = await this.ensureUserDocument(documentId, user.id);
      const next = !userDoc.isFavorite;

      await this.prisma.userDocument.update({
        where: { userId_documentId: { userId: user.id, documentId } },
        data: { isFavorite: next },
      });

      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        next
          ? ActivityType.DOCUMENT_USER_FAVORITED
          : ActivityType.DOCUMENT_USER_UNFAVORITED,
        user,
        next
          ? `User favorited document #${existingDocument.title}`
          : `User unfavorited document #${existingDocument.title}`,
      );

      // Invalidate caches loosely
      await this.cacheManager.del(`document:${documentId}`);
      await this.cacheManager.del(`userDocuments:${user.id}:*` as any);

      return { isFavorite: next };
    } catch (error) {
      this.logger.error('Error toggling favorite document: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to toggle favorite document',
      );
    }
  }

  async toggleUserFollowDocument(
    documentId: string,
    user: JwtPayload,
  ): Promise<{ isFollowing: boolean }> {
    try {
      const existingDocument = await this.prisma.document.findUnique({
        where: { id: documentId, deletedAt: null },
        select: { id: true, title: true },
      });
      if (!existingDocument) {
        this.logger.warn(`Document with ID "${documentId}" does not exist`);
        throw new NotFoundException('Document not found');
      }

      const userDoc = await this.ensureUserDocument(documentId, user.id);
      const next = !userDoc.isFollowing;

      await this.prisma.userDocument.update({
        where: { userId_documentId: { userId: user.id, documentId } },
        data: { isFollowing: next },
      });

      await this.activityLogService.createActivityLog(
        documentId,
        'DOCUMENT',
        next
          ? ActivityType.DOCUMENT_USER_FOLLOWED
          : ActivityType.DOCUMENT_USER_UNFOLLOWED,
        user,
        next
          ? `User followed document #${existingDocument.title}`
          : `User unfollowed document #${existingDocument.title}`,
      );

      // Invalidate caches loosely
      await this.cacheManager.del(`document:${documentId}`);
      await this.cacheManager.del(`userDocuments:${user.id}:*` as any);

      return { isFollowing: next };
    } catch (error) {
      this.logger.error('Error toggling follow document: ', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to toggle follow document',
      );
    }
  }
}
