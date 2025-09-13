import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { CurrentUser } from '../users/users.decorator';
import { DocumentService } from './document.service';

@ApiBearerAuth()
@ApiTags('Documents User')
@UseGuards(JwtAuthGuard)
@Controller('documents/:documentId')
export class DocumentUserController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('/user/favorite')
  @ApiOperation({ summary: 'Update a document to user favorites' })
  async updateDocumentToUserFavorites(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
  ) {
    await this.documentService.toggleUserFavoriteDocument(documentId, user);

    return {
      message: 'Cập nhật tài liệu yêu thích thành công',
      success: true,
    };
  }

  @Post('/user/follow')
  @ApiOperation({ summary: 'Update a document to user follows' })
  async updateDocumentToUserFollows(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
  ) {
    await this.documentService.toggleUserFollowDocument(documentId, user);

    return {
      message: 'Cập nhật tài liệu theo dõi thành công',
      success: true,
    };
  }
}
