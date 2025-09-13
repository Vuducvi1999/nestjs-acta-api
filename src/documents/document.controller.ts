import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { CurrentUser } from '../users/users.decorator';
import { DocumentService } from './document.service';
import {
  CreateDocumentCategoryDto,
  CreateDocumentDto,
} from './dto/create-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PaginatedDocumentResponseDto } from './dto/document-response.dto';
import { CreateDocumentCommentDto } from './dto/create-comment.dto';
import { UpdateDocumentCommentDto } from './dto/update-comment.dto';
import { DocumentCommentQueryDto } from './dto/document-comment-query.dto';
import { DocumentCommentResponseDto } from './dto/document-comment-response.dto';

@ApiBearerAuth()
@ApiTags('Documents')
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentController {
  /**
   *
   */
  constructor(private readonly documentService: DocumentService) {}

  @Get()
  @ApiOperation({ summary: 'Get all documents' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: DocumentQueryDto,
  ) {
    return this.documentService.findAll(query, user);
  }

  @Get('/user')
  @ApiOperation({ summary: 'Get all documents for the user current active' })
  async findAllForUser(
    @CurrentUser() user: JwtPayload,
    query: DocumentQueryDto,
  ) {
    return this.documentService.findAllDocumentsByUser(user, query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all document categories' })
  async findAllCategories() {
    return this.documentService.findAllCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document by ID' })
  async findOne(@Param('id') id: string) {
    return this.documentService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new document' })
  async createDocument(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for creating a document will go here
    return this.documentService.create(dto, user);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new document category' })
  async createCategory(
    @Body() dto: CreateDocumentCategoryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for creating a document category will go here
    return this.documentService.createCategory(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a document by ID' })
  async updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for updating a document will go here
    return this.documentService.update(id, dto, user);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a document by ID' })
  async publishDocument(
    @Param('id') id: string,
    @Body('isPublished') isPublished: boolean,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for publishing a document will go here
    await this.documentService.publishDocument(id, user, isPublished);

    return {
      message: 'Cập nhật trạng thái xuất bản thành công',
      success: true,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document by ID' })
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for deleting a document will go here
    await this.documentService.delete(id, user);

    return { message: 'Xóa tài liệu thành công', success: true };
  }

  @Post(':id/thumbnail')
  @ApiOperation({ summary: 'Update document thumbnail' })
  async updateThumbnail(
    @Param('id') id: string,
    @Body('thumbnailUrl') thumbnailUrl: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for updating document thumbnail will go here
    return this.documentService.updateThumbnail(id, thumbnailUrl, user);
  }

  @Post(':id/attachment')
  @ApiOperation({ summary: 'Update document attachment' })
  async updateAttachment(
    @Param('id') id: string,
    @Body('fileUrl') fileUrl: string,
    @Body('mimeType') mimeType: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for updating document attachment will go here
    return this.documentService.uploadAttachment(id, fileUrl, mimeType, user);
  }

  @Delete(':id/attachment/:attachmentId')
  @ApiOperation({ summary: 'Delete document attachment' })
  async deleteAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for deleting document attachment will go here
    await this.documentService.deleteAttachment(id, attachmentId, user);

    return { message: 'Xóa tệp đính kèm thành công', success: true };
  }

  // --- Document Comments ---

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get paginated root comments for a document' })
  async getDocumentComments(
    @Param('id') id: string,
    @Query() query: DocumentCommentQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    data: DocumentCommentResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.documentService.getDocumentComments(id, query, user.id);
  }

  @Get(':documentId/comments/:commentId')
  @ApiOperation({ summary: 'Get paginated replies for a document comment' })
  async getDocumentCommentReplies(
    @Param('documentId') documentId: string,
    @Param('commentId') commentId: string,
    @Query() query: DocumentCommentQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    data: DocumentCommentResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.documentService.getDocumentCommentReplies(
      documentId,
      commentId,
      query,
      user.id,
    );
  }

  @Post(':id/comments')
  @ApiOperation({
    summary: 'Add a comment to a document (or reply if parentId provided)',
  })
  async addDocumentComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDocumentCommentDto,
  ): Promise<DocumentCommentResponseDto> {
    return this.documentService.addDocumentComment(id, user.id, dto);
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Edit a document comment' })
  async updateDocumentComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDocumentCommentDto,
  ): Promise<DocumentCommentResponseDto> {
    return this.documentService.updateDocumentComment(commentId, user.id, dto);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete a document comment' })
  async deleteDocumentComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: boolean }> {
    await this.documentService.deleteDocumentComment(commentId, user.id);
    return { success: true };
  }

  @Post('comments/:commentId/like')
  @ApiOperation({ summary: 'Like/unlike a document comment' })
  async toggleDocumentCommentLike(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ liked: boolean }> {
    return this.documentService.toggleDocumentCommentLike(commentId, user.id);
  }
}
