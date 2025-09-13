import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Response,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Body } from '@nestjs/common';
import { NewsService } from './news.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth } from '@nestjs/swagger';
import { NewsQueryDto } from './dto/news-query.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { JwtPayload } from '../auth/jwt-payload';
import { CurrentUser } from '../users/users.decorator';
import { CreateNewsCommentDto } from './dto/create-comment.dto';
import { UpdateNewsCommentDto } from './dto/update-comment.dto';
import { NewsCommentQueryDto } from './dto/news-comment-query.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { NewsTitleDateDto } from './dto/news-title-date.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PaginatedNewsItemResponseDto } from './dto/news-response.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('news')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('liked')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get liked news for current user',
    description:
      'Returns paginated list of news items liked by the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liked news retrieved successfully',
    type: PaginatedNewsItemResponseDto,
  })
  async getLikedNews(
    @Query() query: NewsQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaginatedNewsItemResponseDto> {
    return this.newsService.getLikedNews(user.id, query);
  }

  @Get()
  async findAll(@Query() filter: NewsQueryDto) {
    return this.newsService.findAll(filter);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin')
  async findAllAdmin(@Query() filter: NewsQueryDto) {
    return this.newsService.findAllAdmin(filter);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.newsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createNewsItemDto: CreateNewsDto,
  ) {
    return this.newsService.create(createNewsItemDto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('many')
  async createMany(
    @CurrentUser() user: JwtPayload,
    @Body() createNewsItemDto: CreateNewsDto[],
  ) {
    return this.newsService.createMany(createNewsItemDto, user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateNewsDto: UpdateNewsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.newsService.update(id, updateNewsDto, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.newsService.delete(id);
  }

  @Patch(':id/views')
  async incrementView(@Param('id') id: string) {
    return this.newsService.incrementView(id);
  }

  @Post(':id/like')
  async toggleLike(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.newsService.toggleLike(id, user.id);
  }

  @Get(':id/comments')
  async getComments(
    @Param('id') id: string,
    @Query() query: NewsCommentQueryDto,
  ) {
    return this.newsService.getCommentsPaginated(id, query);
  }

  @Get(':newsItemId/comments/:commentId')
  async getRepliesComments(
    @Param('commentId') commentId: string,
    @Param('newsItemId') newsItemId: string,
  ) {
    return this.newsService.getRepliesComments(newsItemId, commentId);
  }

  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() commentDto: CreateNewsCommentDto,
  ) {
    return this.newsService.addComment(id, user.id, commentDto);
  }

  @Patch('comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
    @Body() commentDto: UpdateNewsCommentDto,
  ) {
    return this.newsService.updateComment(commentId, user.id, commentDto);
  }

  @Delete('comments/:commentId')
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.newsService.deleteComment(commentId, user.id);
  }

  @Post('comments/:commentId/like')
  async toggleCommentLike(
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.newsService.toggleCommentLike(commentId, user.id);
  }
}
