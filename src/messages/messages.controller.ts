import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { CurrentUser } from '../users/users.decorator';
import { MessagesService } from './messages.service';
import { ConversationsQueryDto } from './dto/conversations-query.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SuggestedConversationsQueryDto } from './dto/suggested-conversations-query.dto';
import { ToggleConversationVisibilityDto } from './dto/toggle-conversation-visibility.dto';
import { AddMembersDto } from './dto/add-members.dto';
import {
  PaginatedConversationsResponseDto,
  SuggestedConversationsResponseDto,
  ConversationResponseDto,
} from './dto/conversations-response.dto';

@ApiBearerAuth()
@ApiTags('Messages')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversations retrieved successfully',
    type: PaginatedConversationsResponseDto,
  })
  async findAll(
    @Query() query: ConversationsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.findAll(query, user);
  }

  @Get('recent-conversations')
  @ApiOperation({ summary: 'Get recent conversations' })
  async getRecentConversations(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getRecentConversations(user);
  }

  @Get('suggested-conversations')
  @ApiOperation({
    summary:
      'Get suggested conversations from referral tree or search all users',
    description:
      'Returns suggested users for starting conversations. When no search query is provided, returns users from the referral tree (depth 1-3). When a search query is provided, searches ALL users by name, email, phone, or reference ID. Only returns individual users, not group conversations.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Suggested conversations retrieved successfully',
    type: SuggestedConversationsResponseDto,
  })
  async getSuggestedConversations(
    @CurrentUser() user: JwtPayload,
    @Query() query: SuggestedConversationsQueryDto,
  ) {
    return this.messagesService.getSuggestedConversations(user, query);
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'Get messages for a specific conversation' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Messages retrieved successfully',
  })
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.getConversationMessages(conversationId, user);
  }

  @Get('latest-messages')
  @ApiOperation({ summary: 'Get latest messages for all conversations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Latest messages retrieved successfully',
  })
  async getLatestMessagesForAllConversations(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.getLatestMessagesForAllConversations(
      user,
      limit,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Conversation created successfully',
    type: ConversationResponseDto,
  })
  async createConversation(
    @Body() createConversationDto: CreateConversationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.createConversation(createConversationDto, user);
  }

  @Post('toggle-visibility')
  @ApiOperation({ summary: 'Toggle conversation visibility (hide/show)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Conversation visibility toggled successfully',
  })
  async toggleConversationVisibility(
    @Body() toggleDto: ToggleConversationVisibilityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.toggleConversationVisibility(
      toggleDto.conversationId,
      toggleDto.isHidden,
      user,
    );
  }

  @Get('hidden-conversations')
  @ApiOperation({ summary: 'Get hidden conversations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hidden conversations retrieved successfully',
    type: [ConversationResponseDto],
  })
  async getHiddenConversations(@CurrentUser() user: JwtPayload) {
    return this.messagesService.getHiddenConversations(user);
  }

  @Get('all-including-hidden')
  @ApiOperation({ summary: 'Get all conversations including hidden ones' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All conversations retrieved successfully',
    type: PaginatedConversationsResponseDto,
  })
  async getAllConversationsIncludingHidden(
    @Query() query: ConversationsQueryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.getAllConversationsIncludingHidden(user, query);
  }

  @Post(':conversationId/members')
  @ApiOperation({ summary: 'Add members to a conversation (OWNER only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Members added' })
  async addMembers(
    @Param('conversationId') conversationId: string,
    @Body() body: AddMembersDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.addMembers(
      conversationId,
      body.memberIds,
      user,
    );
  }
}
