import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentChapterService } from './document-chapter.service';
import { CreateDocumentChapterDto } from './dto/create-document.dto';
import { CurrentUser } from '../users/users.decorator';
import { JwtPayload } from '../auth/jwt-payload';
import { UpdateDocumentChapterDto } from './dto/update-document.dto';

@ApiBearerAuth()
@ApiTags('Document Chapters')
@UseGuards(JwtAuthGuard)
@Controller('documents/:id/chapters')
export class DocumentChapterController {
  constructor(
    private readonly documentChapterService: DocumentChapterService,
  ) {}

  @Get(':chapterId')
  @ApiOperation({ summary: 'Get a chapter of a document by ID' })
  async findChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.documentChapterService.findChapterByid(id, chapterId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new chapter for a document' })
  async createChapter(
    @Param('id') id: string,
    @Body() dto: CreateDocumentChapterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for creating a document chapter will go here
    return this.documentChapterService.createChapter(id, dto, user);
  }

  @Post(':chapterId/user/view')
  @ApiOperation({
    summary: 'Mark a chapter view of a document for user',
  })
  async markChapterView(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for marking a document chapter as viewed for user will go here
    await this.documentChapterService.incrementChapterViews(
      id,
      chapterId,
      user,
    );

    return { message: 'Đánh dấu chương đã xem thành công', success: true };
  }

  @Post(':chapterId/user/complete')
  @ApiOperation({
    summary: 'Mark a chapter completeion of a document for user',
  })
  async markChapterComplete(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for marking a document chapter as complete for user will go here
    await this.documentChapterService.toggleUserCompleteChapter(
      id,
      chapterId,
      user,
    );

    return { message: 'Đánh dấu chương hoàn thành thành công', success: true };
  }

  @Patch(':chapterId')
  @ApiOperation({ summary: 'Update a chapter of a document by ID' })
  async updateChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateDocumentChapterDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for updating a document chapter will go here
    return this.documentChapterService.updateChapter(id, chapterId, dto, user);
  }

  @Patch(':chapterId/publish')
  @ApiOperation({ summary: 'Publish a chapter of a document by ID' })
  async publishChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @Body('isPublished') isPublished: boolean,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for publishing a document chapter will go here
    return this.documentChapterService.publishChapter(
      id,
      chapterId,
      user,
      isPublished,
    );
  }

  @Delete(':chapterId')
  @ApiOperation({ summary: 'Delete a chapter of a document by ID' })
  async deleteChapter(
    @Param('id') id: string,
    @Param('chapterId') chapterId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for deleting a document chapter will go here
    await this.documentChapterService.deleteChapter(id, chapterId, user);

    return { message: 'Xóa chương thành công', success: true };
  }

  @Put('reorder')
  @ApiOperation({ summary: 'Reorder document chapters' })
  async reorderChapters(
    @Param('id') id: string,
    @Body() chapters: { id: string; position: number }[],
    @CurrentUser() user: JwtPayload,
  ) {
    // Implementation for reordering document chapters will go here
    return this.documentChapterService.bulkOrderChapters(id, chapters, user);
  }
}
