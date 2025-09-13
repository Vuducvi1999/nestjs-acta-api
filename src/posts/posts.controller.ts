import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostService } from './posts.service';
import { PostQueryDto } from './dto/post-query.dto';
import {
  CreatePostCommentDto,
  UpdatePostCommentDto,
  CommentResponseDto,
} from './dto/comment.dto';
import { CommentsService } from './comments.service';
import {
  PaginatedPostResponseDto,
  PostFeelingResponseDto,
  PostActivityCategoryResponseDto,
  PostActivityResponseDto,
} from './dto/post-response.dto';

@ApiBearerAuth()
@ApiTags('Posts')
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly commentService: CommentsService,
  ) {}

  @Get('place-suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get place suggestions from Goong.io API',
    description: 'Returns place suggestions based on the provided query',
  })
  @ApiQuery({
    name: 'query',
    required: true,
    type: String,
    description: 'Search query for place suggestions',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Place suggestions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        predictions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              place_id: { type: 'string' },
              structured_formatting: {
                type: 'object',
                properties: {
                  main_text: { type: 'string' },
                  secondary_text: { type: 'string' },
                },
              },
            },
          },
        },
        error_message: { type: 'string' },
      },
    },
  })
  async getPlaceSuggestions(@Query('query') query: string): Promise<any> {
    return this.postService.getPlaceSuggestions(query);
  }

  @Get('liked')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get liked posts for current user',
    description: 'Returns paginated list of posts liked by the current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Liked posts retrieved successfully',
    type: PaginatedPostResponseDto,
  })
  async getLikedPosts(
    @Query() query: PostQueryDto,
    @Request() req: any,
  ): Promise<PaginatedPostResponseDto> {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.postService.getLikedPosts(currentUserId, query);
  }

  @Get('saved')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get saved posts for current user' })
  async getSavedPosts(
    @Query() query: PostQueryDto,
    @Request() req: any,
  ): Promise<PaginatedPostResponseDto> {
    const currentUserId = req.user?.id;
    if (!currentUserId)
      throw new UnauthorizedException('User not authenticated');
    return this.postService.getSavedPosts(currentUserId, query);
  }

  @Get('feelings')
  @ApiOperation({ summary: 'Get all post feelings' })
  async getAllFeelings(): Promise<PostFeelingResponseDto[]> {
    return this.postService.getAllFeelings();
  }

  @Get('activity-categories')
  @ApiOperation({ summary: 'Get all post activity categories' })
  async getAllActivityCategories(): Promise<PostActivityCategoryResponseDto[]> {
    return this.postService.getAllActivityCategories();
  }

  @Get('activities/:categoryId')
  @ApiOperation({ summary: 'Get all post activities by category ID' })
  async getActivitiesByCategoryId(
    @Param('categoryId') categoryId: string,
  ): Promise<PostActivityResponseDto[]> {
    return this.postService.getActivitiesByCategoryId(categoryId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all posts' })
  async findAll(@Query() query: PostQueryDto, @Request() req: any) {
    const currentUserId = req.user?.id;
    return this.postService.findAll(query, currentUserId);
  }

  @Get('/:postId')
  @ApiOperation({ summary: 'Get post by ID' })
  @ApiQuery({ name: 'includeAnalytics', required: false, type: Boolean })
  async findOne(
    @Param('postId') postId: string,
    @Query('includeAnalytics') includeAnalytics: boolean = false,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.id;
    return this.postService.findOne(postId, currentUserId, includeAnalytics);
  }

  @Post('bookmark')
  @ApiOperation({ summary: 'Save/bookmark a post' })
  async bookmarkPost(
    @Body() body: any,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('User not authenticated');

    const postId = body?.postId ?? body?.data?.postId;
    if (!postId) {
      throw new (await import('@nestjs/common')).BadRequestException(
        'postId is required',
      );
    }

    return this.postService.savePost(postId, userId);
  }

  @Delete('bookmark/:postId')
  @ApiOperation({ summary: 'Unsave/unbookmark a post' })
  async unbookmarkPost(
    @Param('postId') postId: string,
    @Request() req: any,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('User not authenticated');
    return this.postService.unsavePost(postId, userId);
  }

  @Get('/:postId/analytics')
  @ApiOperation({ summary: 'Get post analytics by ID' })
  async findPostAnalytics(
    @Param('postId') postId: string,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.id;
    return this.postService.findPostAnalytics(postId, currentUserId);
  }

  // --- Comments ---
  @Post('/:postId/comments')
  @ApiOperation({ summary: 'Add comment to post' })
  async addComment(
    @Param('postId') postId: string,
    @Body() createCommentDto: CreatePostCommentDto,
    @Request() req: any,
  ): Promise<CommentResponseDto> {
    const userId = req.user.id;
    return this.commentService.addComment(createCommentDto, postId, userId);
  }

  @Put('/comments/:commentId')
  @ApiOperation({ summary: 'Update comment' })
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdatePostCommentDto,
    @Request() req: any,
  ): Promise<CommentResponseDto> {
    const userId = req.user.id;
    return this.commentService.updateComment(
      commentId,
      updateCommentDto,
      userId,
    );
  }

  @Delete('/comments/:commentId')
  @ApiOperation({ summary: 'Delete comment' })
  async deleteComment(
    @Param('commentId') commentId: string,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    return this.commentService.deleteComment(commentId, userId);
  }

  @Get('/:postId/comments')
  @ApiOperation({ summary: 'Get top-level comments for post' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getTopLevelComments(
    @Param('postId') postId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Request() req: any,
  ): Promise<CommentResponseDto[]> {
    const currentUserId = req.user?.id;
    return this.commentService.getTopLevelComments(
      postId,
      Number(page),
      Number(limit),
      currentUserId,
    );
  }

  @Get('/comments/:parentId/replies')
  @ApiOperation({ summary: 'Get replies for a comment' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getReplies(
    @Param('parentId') parentId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Request() req: any,
  ): Promise<CommentResponseDto[]> {
    const currentUserId = req.user?.id;
    return this.commentService.getReplies(
      parentId,
      Number(page),
      Number(limit),
      currentUserId,
    );
  }
}
