import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { AttachmentService } from '../../attachments/attachment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateUserAvatarDto } from '../dto/update-user-avatar.dto';
import { UpdateUserCoverDto } from '../dto/update-user-cover.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserHandleRequestActionDto } from '../dto/user-handle-request-action.dto';
import { UserProfileResponseDto } from '../dto/user-profile-response.dto';
import { UserQueryDto } from '../dto/user-query.dto';
import { PaginatedUserResponseDto } from '../dto/user-response.dto';
import { PaginatedReferralUserResponseDto } from '../dto/referral-user-response.dto';
import {
  UserReferenceResponse,
  UserResponse,
  UserStatisticsResponse,
} from '../models';
import { CurrentUser } from '../users.decorator';
import { UserService } from '../services/user.service';
import { JwtPayload } from '../../auth/jwt-payload';
import { CreateKYCDto } from '../dto/create-kyc.dto';
import { UpdateKYCDto } from '../dto/update-kyc.dto';
import { UserSearchService } from '../services/user-search.service';
import { UserKYCCronService } from '../services/user-kyc-cron.service';
import { AvatarPostService } from '../services/avatar-post.service';
import { UserAvatarPostPreferences } from '../types/avatar-post.types';
type AuthUser = User;

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userSearchService: UserSearchService,
    private readonly attachmentService: AttachmentService,
    private readonly userKYCCronService: UserKYCCronService,
    private readonly avatarPostService: AvatarPostService,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll(
    @Query() query: UserQueryDto,
  ): Promise<PaginatedUserResponseDto> {
    return this.userService.findAll(query);
  }

  @Get('statistics')
  async getUserStatistics(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<UserStatisticsResponse> {
    return this.userService.getUserStatistics(currentUser.id);
  }

  @Get('avatar')
  @ApiOperation({ summary: 'Get current user avatar URL' })
  @ApiResponse({
    status: 200,
    description: 'Returns current user avatar URL',
    schema: {
      type: 'object',
      properties: {
        avatarUrl: {
          type: 'string',
          nullable: true,
          description: 'URL of the user avatar',
        },
      },
    },
  })
  async getCurrentUserAvatar(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ avatarUrl: string | null }> {
    return this.userService.getCurrentUserAvatar(currentUser.id);
  }

  @Get('cover')
  @ApiOperation({ summary: 'Get current user cover URL' })
  @ApiResponse({
    status: 200,
    description: 'Returns current user cover URL',
    schema: {
      type: 'object',
      properties: {
        coverUrl: {
          type: 'string',
          nullable: true,
          description: 'URL of the user cover',
        },
      },
    },
  })
  async getCurrentUserCover(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<{ coverUrl: string | null }> {
    return this.userService.getCurrentUserCover(currentUser.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('hierarchy-tree')
  async getReferralHierarchy(@CurrentUser() user: JwtPayload) {
    return { referenceIds: [] }; // Return empty array since we don't use this anymore
  }

  @Get(`/suggest`)
  @ApiOperation({ summary: 'Get user suggestions' })
  findSuggestions(
    @CurrentUser() currentUser: AuthUser,
  ): Promise<UserResponse[]> {
    return this.userService.findSuggestUsers(currentUser);
  }

  @Get('/old-avatars')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user old avatars' })
  async getOldAvatars(@CurrentUser() currentUser: AuthUser) {
    return this.attachmentService.getUserOldAvatars(currentUser.id);
  }

  @Get('/old-covers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user old covers' })
  async getOldCovers(@CurrentUser() currentUser: AuthUser) {
    return this.attachmentService.getUserOldCovers(currentUser.id);
  }

  @Get('/new-users')
  @ApiOperation({ summary: 'Get new users' })
  @ApiResponse({
    status: 200,
    description: 'Returns new users',
  })
  async getNewUsers() {
    return this.userService.getNewUsers();
  }

  @Get('/profile/:id')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns user profile',
    type: UserProfileResponseDto,
  })
  async getUserProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<UserProfileResponseDto> {
    return this.userService.getUserProfile(user, id);
  }

  @Get('/search')
  @ApiOperation({ summary: 'Search verified users' })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of verified users matching search query',
    type: [UserReferenceResponse],
  })
  async searchVerifiedUsers(
    @Query('q') searchQuery: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserReferenceResponse[]> {
    return this.userSearchService.searchVerifiedUsers(searchQuery, currentUser);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Get('/referral-users/:userId')
  @ApiOperation({ summary: 'Get referral users with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'direct', 'indirect'],
    description: 'Type of referrals to fetch (default: all)',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Search term for filtering users',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by user status (e.g., active, pending, kyc_submitted)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated referral users',
    type: PaginatedReferralUserResponseDto,
  })
  async getReferralUsers(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: 'all' | 'direct' | 'indirect',
    @Query('searchTerm') searchTerm?: string,
    @Query('status') status?: string,
  ): Promise<PaginatedReferralUserResponseDto> {
    const paginationOptions = page && limit ? { page, limit } : undefined;
    return this.userService.getReferralUsers(
      userId,
      currentUser,
      paginationOptions,
      type,
      searchTerm,
      status,
    );
  }

  @Get('/direct-referrals/:userId')
  @ApiOperation({ summary: 'Get direct referrals with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated direct referrals',
    type: PaginatedReferralUserResponseDto,
  })
  async getDirectReferrals(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('searchTerm') searchTerm?: string,
    @Query('status') status?: string,
  ): Promise<PaginatedReferralUserResponseDto> {
    const paginationOptions = page && limit ? { page, limit } : undefined;
    return this.userService.getDirectReferrals(
      userId,
      currentUser,
      paginationOptions,
      searchTerm,
      status,
    );
  }

  @Get('/indirect-referrals/:userId')
  @ApiOperation({ summary: 'Get indirect referrals with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated indirect referrals',
    type: PaginatedReferralUserResponseDto,
  })
  async getIndirectReferrals(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('searchTerm') searchTerm?: string,
    @Query('status') status?: string,
  ): Promise<PaginatedReferralUserResponseDto> {
    const paginationOptions = page && limit ? { page, limit } : undefined;
    return this.userService.getIndirectReferrals(
      userId,
      currentUser,
      paginationOptions,
      searchTerm,
      status,
    );
  }

  @Get(':userId/indirect-referrals')
  @ApiOperation({ summary: 'Get paginated indirect referrals for a user' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 5, max: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated indirect referrals',
    type: PaginatedReferralUserResponseDto,
  })
  async getPaginatedIndirectReferrals(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedReferralUserResponseDto> {
    return this.userService.getPaginatedIndirectReferrals(userId, currentUser, {
      page: page || 1,
      limit: Math.min(limit || 5, 50), // Cap at 50 items per page
    });
  }

  @Get('/admin/referral-users/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Get referral users for admin (no hierarchy restrictions)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'direct', 'indirect'],
    description: 'Type of referrals to fetch (default: all)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated referral users for admin',
    type: PaginatedReferralUserResponseDto,
  })
  async getAdminReferralUsers(
    @Param('userId') userId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: 'all' | 'direct' | 'indirect',
  ): Promise<PaginatedReferralUserResponseDto> {
    const paginationOptions = page && limit ? { page, limit } : undefined;
    return this.userService.getAdminReferralUsers(
      userId,
      paginationOptions,
      type,
    );
  }

  @Patch('update-avatar')
  @ApiOperation({ summary: 'Update user avatar' })
  @ApiResponse({
    status: 200,
    description: 'Avatar updated successfully',
    type: Object,
  })
  async uploadFile(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateUserAvatarDto,
  ) {
    const result = await this.userService.updateUserAvatar(
      currentUser.id,
      body.avatarUrl,
      body.originalFileName,
    );

    return {
      success: true,
      data: result,
      message: 'Avatar updated successfully',
    };
  }

  @Patch('update-cover')
  @ApiOperation({ summary: 'Update user cover' })
  async updateCover(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateUserCoverDto,
  ) {
    return this.userService.updateUserCover(
      currentUser.id,
      body.coverUrl,
      body.originalFileName,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Get('/reference/:referenceId')
  @Public()
  async findByReferenceId(
    @Param('referenceId') referenceId: string,
  ): Promise<UserReferenceResponse> {
    return this.userService.findByReferenceId(referenceId);
  }

  @Get('/:id/referral-link')
  @ApiOperation({ summary: 'Generate referral link for a user' })
  @ApiResponse({
    status: 200,
    description: 'Returns the referral link for the user',
    schema: {
      type: 'object',
      properties: {
        referralLink: {
          type: 'string',
          description: 'The complete referral link',
        },
        referenceId: {
          type: 'string',
          description: 'The user reference ID',
        },
        userId: {
          type: 'string',
          description: 'The user ID',
        },
      },
    },
  })
  async generateReferralLink(
    @Param('id') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<{
    referralLink: string;
    referenceId: string;
    userId: string;
  }> {
    // Check if the current user has permission to generate referral link for this user
    // Users can only generate their own referral link or admins can generate for anyone
    if (currentUser.id !== userId && currentUser.role !== Role.ADMIN) {
      throw new Error('Unauthorized to generate referral link for this user');
    }

    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.referenceId) {
      throw new Error('User does not have a reference ID');
    }

    // Generate referral link with timestamp for uniqueness
    const timestamp = new Date(user.createdAt).getTime();
    const referralLink = `https://acta.vn/sign-up/${user.referenceId}-${timestamp}`;

    return {
      referralLink,
      referenceId: user.referenceId,
      userId: user.id,
    };
  }

  @Get('/admin/all')
  @Roles(Role.ADMIN)
  async findAllForAdmin(
    @Query() query: UserQueryDto,
  ): Promise<PaginatedUserResponseDto> {
    return this.userSearchService.findAllForAdmin(query);
  }

  @Patch('/admin/:id/:requestAction')
  @Roles(Role.ADMIN)
  async requestAction(
    @Param('id') id: string,
    @Param('requestAction') requestAction: string,
    @Body() body: UserHandleRequestActionDto,
  ) {
    return this.userService.requestAction(id, requestAction, body.reason);
  }

  @Patch(':id/referrer/:referrerId/:requestAction')
  async referrerAction(
    @Param('id') id: string,
    @Param('referrerId') referrerId: string,
    @Param('requestAction') requestAction: string,
    @Body() body: UserHandleRequestActionDto,
  ) {
    return this.userService.referrerAction(
      id,
      referrerId,
      requestAction,
      body.reason,
    );
  }

  // KYC Endpoints
  @Post('/kyc/current')
  @ApiOperation({ summary: 'Create KYC submission' })
  @ApiResponse({
    status: 201,
    description: 'KYC submitted successfully',
  })
  async createKYC(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateKYCDto,
  ) {
    return this.userService.createKYC(currentUser.id, body);
  }

  @Get('/kyc/current')
  @ApiOperation({ summary: 'Get KYC submission' })
  @ApiResponse({
    status: 200,
    description: 'Returns KYC submission',
  })
  async getKYC(@CurrentUser() currentUser: AuthUser) {
    return this.userService.getKYC(currentUser.id);
  }

  @Put('/kyc/current')
  @ApiOperation({ summary: 'Update KYC submission' })
  @ApiResponse({
    status: 200,
    description: 'KYC updated successfully',
  })
  async updateKYC(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateKYCDto,
  ) {
    return this.userService.updateKYC(currentUser.id, body);
  }

  @Put('/kyc/action')
  @ApiOperation({
    summary: 'Perform KYC action (draft, submit, approve, reject)',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC action performed successfully',
  })
  async performKYCAction(
    @CurrentUser() currentUser: AuthUser,
    @Body()
    body: {
      action: 'draft' | 'submit' | 'approve' | 'reject';
      message: string;
    },
  ) {
    return this.userService.performKYCAction(
      currentUser.id,
      body.action,
      body.message,
    );
  }

  @Get('/kyc/admin/submissions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all KYC submissions for admin' })
  @ApiResponse({
    status: 200,
    description: 'Returns all KYC submissions',
  })
  async getAllKYCSubmissions(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.userService.getAllKYCSubmissions({ page, limit, status });
  }

  @Get('/kyc/admin/submissions/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get specific KYC submission for admin' })
  @ApiResponse({
    status: 200,
    description: 'Returns specific KYC submission',
  })
  async getKYCById(@Param('id') id: string) {
    return this.userService.getKYCById(id);
  }

  @Get('/kyc/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get KYC information by user ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns user KYC information',
  })
  async getKYCByUserId(@Param('userId') userId: string) {
    return this.userService.getKYCByUserId(userId);
  }

  @Patch('/kyc/admin/:kycId/action')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Perform KYC action by admin (approve, requestChange)',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC action performed successfully',
  })
  async performKYCActionByAdmin(
    @Param('kycId') kycId: string,
    @Body() body: { action: 'approve' | 'requestChange'; message?: string },
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.userService.performKYCActionByAdmin(
      kycId,
      body.action,
      admin.id,
      body.message,
    );
  }

  @Post('/admin/kyc/trigger-check')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Manually trigger KYC check (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC check triggered successfully',
  })
  async triggerKYCCheck(@CurrentUser() admin: JwtPayload) {
    await this.userKYCCronService.triggerKYCSubmittedCheck();
    return {
      success: true,
      message: 'KYC check triggered successfully by admin',
      triggeredBy: admin.id,
      triggeredAt: new Date(),
    };
  }

  @Post('/admin/kyc/trigger-reminder')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Manually trigger KYC reminder emails (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC reminder emails triggered successfully',
  })
  async triggerKYCReminder(@CurrentUser() admin: JwtPayload) {
    await this.userKYCCronService.triggerKYCReminder();

    return {
      success: true,
      message: 'KYC reminder emails triggered successfully by admin',
      triggeredBy: admin.id,
      triggeredAt: new Date(),
    };
  }

  @Post('/admin/kyc/trigger-changing-reminder')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Manually trigger KYC changing reminder emails (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC changing reminder emails triggered successfully',
  })
  async triggerKYCChangingReminder(@CurrentUser() admin: JwtPayload) {
    await this.userKYCCronService.triggerKYCChangingReminder();

    return {
      success: true,
      message: 'KYC changing reminder emails triggered successfully by admin',
      triggeredBy: admin.id,
      triggeredAt: new Date(),
    };
  }

  // ==================== AVATAR POST MANAGEMENT ====================

  @Get('/avatar-post/preferences')
  @ApiOperation({ summary: 'Get user avatar post preferences' })
  @ApiResponse({
    status: 200,
    description: 'Returns user avatar post preferences',
  })
  async getAvatarPostPreferences(@CurrentUser() currentUser: AuthUser) {
    // This would typically get preferences from user config
    // For now, return default preferences
    return {
      success: true,
      data: {
        enabled: true,
        postType: 'simple',
        autoPublish: true,
        includeComparison: false,
        notifyFollowers: true,
      },
    };
  }

  @Put('/avatar-post/preferences')
  @ApiOperation({ summary: 'Update user avatar post preferences' })
  @ApiResponse({
    status: 200,
    description: 'Avatar post preferences updated successfully',
  })
  async updateAvatarPostPreferences(
    @CurrentUser() currentUser: AuthUser,
    @Body() preferences: Partial<UserAvatarPostPreferences>,
  ) {
    await this.avatarPostService.updateUserPreferences(
      currentUser.id,
      preferences,
    );

    return {
      success: true,
      message: 'Avatar post preferences updated successfully',
    };
  }

  @Get('/avatar-post/stats')
  @ApiOperation({ summary: 'Get avatar post statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns avatar post statistics',
  })
  async getAvatarPostStats(@CurrentUser() currentUser: AuthUser) {
    const stats = await this.avatarPostService.getAvatarPostStats(
      currentUser.id,
    );

    return {
      success: true,
      data: stats,
    };
  }

  @Get('/admin/avatar-post/stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get global avatar post statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns global avatar post statistics',
  })
  async getGlobalAvatarPostStats() {
    const stats = await this.avatarPostService.getAvatarPostStats();

    return {
      success: true,
      data: stats,
    };
  }
}
