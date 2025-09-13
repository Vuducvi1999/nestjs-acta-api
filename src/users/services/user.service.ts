import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KycStatus, User, UserStatus, Role } from '@prisma/client';
import { AuthUser } from '../../auth/auth-user';
import { JwtPayload } from '../../auth/jwt-payload';
import { PrismaService } from '../../common/services/prisma.service';
import { UserActionService } from './user-action.service';
import { UserProfileService } from './user-profile.service';
import { UserReferralService } from './user-referral.service';
import { UserSearchService } from './user-search.service';
import { UserStatisticsService } from './user-statistics.service';
import { UserCacheUtil } from '../utils/user-cache.util';
import { UpdateUserRequest, UserResponse } from '../models';
import { CreateKYCDto } from '../dto/create-kyc.dto';
import { UpdateKYCDto } from '../dto/update-kyc.dto';
import { ActivityLogService } from '../../activity-logs/activity-log.service';
import { ActivityTargetType, ActivityType } from '@prisma/client';
import { MailService } from '../../mail/mail.service';
import { NotificationService } from '../../notifications/notification.service';
import { RelatedModel, NotificationAction } from '@prisma/client';
import { USER_CONFIG_KEYS } from '../models/user-config.constant';
import { SocketEmitterService } from '../services/socket-emitter.service';

// Type for selected user fields
type SelectedUserFields = {
  id: string;
  fullName: string;
  email: string;
  referenceId: string;
  phoneNumber: string;
  dob: Date | null;
  gender: any;
  verificationDate: Date | null;
  role: any;
  isActive: boolean;
  country: string;
  status: any;
  createdAt: Date;
  updatedAt: Date;
  avatar?: {
    fileUrl: string;
  } | null;
};

// Type for admin user fields
type AdminUserFields = {
  id: string;
  fullName: string;
  email: string;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfileService: UserProfileService,
    private readonly userReferralService: UserReferralService,
    private readonly userStatisticsService: UserStatisticsService,
    private readonly userActionService: UserActionService,
    private readonly userSearchService: UserSearchService,
    private readonly userCacheUtil: UserCacheUtil,
    private readonly activityLogService: ActivityLogService,
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
    private readonly socketEmitterService: SocketEmitterService,
  ) {}

  // Auth-related methods
  public async getUserEntityById(id: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  public async getUserEntityByEmail(email: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  // User update methods
  async updateUser(
    userId: string,
    updateRequest: UpdateUserRequest,
  ): Promise<UserResponse> {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updateRequest,
          dob: updateRequest.dob,
        },
      });

      return UserResponse.fromUserEntity(updatedUser);
    } catch (err) {
      Logger.error(JSON.stringify(err));
      throw new Error('Failed to update user');
    }
  }

  // User removal
  async remove(id: string): Promise<void> {
    await this.userProfileService.findOne(id);
    await this.prisma.user.delete({ where: { id } });
  }

  // Delegate to specialized services
  async getUserProfile(user: JwtPayload, id: string) {
    return this.userProfileService.getUserProfile(user, id);
  }

  async update(id: string, updateUserDto: any): Promise<User> {
    return this.userProfileService.update(id, updateUserDto);
  }

  async updateUserAvatar(
    userId: string,
    avatarUrl: string,
    originalFileName?: string,
  ) {
    return this.userProfileService.updateUserAvatar(
      userId,
      avatarUrl,
      originalFileName,
    );
  }

  async updateUserCover(
    userId: string,
    coverUrl: string,
    originalFileName?: string,
  ) {
    return this.userProfileService.updateUserCover(
      userId,
      coverUrl,
      originalFileName,
    );
  }

  async getCurrentUserAvatar(userId: string) {
    return this.userProfileService.getCurrentUserAvatar(userId);
  }

  async getCurrentUserCover(userId: string) {
    return this.userProfileService.getCurrentUserCover(userId);
  }

  async findOne(id: string): Promise<User> {
    return this.userProfileService.findOne(id);
  }

  async findById(id: string): Promise<SelectedUserFields | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        referenceId: true,
        phoneNumber: true,
        dob: true,
        gender: true,
        verificationDate: true,
        role: true,
        isActive: true,
        country: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        avatar: {
          select: {
            fileUrl: true,
          },
        },
      },
    });
  }

  async findAdminUsers(): Promise<AdminUserFields[]> {
    return this.prisma.user.findMany({
      where: {
        role: 'admin',
        status: 'active',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });
  }

  async findByEmail(email: string): Promise<SelectedUserFields | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        fullName: true,
        email: true,
        referenceId: true,
        phoneNumber: true,
        dob: true,
        gender: true,
        verificationDate: true,
        role: true,
        isActive: true,
        country: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByReferenceId(referenceId: string) {
    return this.userProfileService.findByReferenceId(referenceId);
  }

  async getNewUsers() {
    return this.userProfileService.getNewUsers();
  }

  // Referral methods
  async getReferralUsers(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
    referralType?: 'all' | 'direct' | 'indirect',
    searchTerm?: string,
    status?: string,
  ) {
    return this.userReferralService.getReferralUsers(
      userId,
      user,
      paginationOptions,
      referralType,
      searchTerm,
      status,
    );
  }

  async getPaginatedIndirectReferrals(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
  ) {
    return this.userReferralService.getPaginatedIndirectReferrals(
      userId,
      user,
      paginationOptions,
    );
  }

  async getDirectReferrals(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
    searchTerm?: string,
    status?: string,
  ) {
    return this.userReferralService.getDirectReferrals(
      userId,
      user,
      paginationOptions,
      searchTerm,
      status,
    );
  }

  async getIndirectReferrals(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
    searchTerm?: string,
    status?: string,
  ) {
    return this.userReferralService.getIndirectReferrals(
      userId,
      user,
      paginationOptions,
      searchTerm,
      status,
    );
  }

  async getAdminReferralUsers(
    userId: string,
    paginationOptions?: { page: number; limit: number },
    referralType?: 'all' | 'direct' | 'indirect',
  ) {
    return this.userReferralService.getAdminReferralUsers(
      userId,
      paginationOptions,
      referralType,
    );
  }

  // Statistics methods
  async getUserStatistics(userId: string) {
    return this.userStatisticsService.getUserStatistics(userId);
  }

  // Action methods
  async requestAction(id: string, requestAction: string, reason: string = '') {
    return this.userActionService.requestAction(id, requestAction, reason);
  }

  async referrerAction(
    userId: string,
    referrerId: string,
    requestAction: string,
    reason: string = '',
  ) {
    return this.userActionService.referrerAction(
      userId,
      referrerId,
      requestAction,
      reason,
    );
  }

  // Search methods
  async findAll(query: any = {}) {
    return this.userSearchService.findAll(query);
  }

  async findSuggestUsers(user: JwtPayload) {
    return this.userSearchService.findSuggestUsers(user);
  }

  // KYC methods
  async createKYC(userId: string, body: CreateKYCDto) {
    return this.userProfileService.createKYC(userId, body);
  }

  async getKYC(userId: string) {
    return this.userProfileService.getKYC(userId);
  }

  async updateKYC(userId: string, body: UpdateKYCDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('User not found');

      const existingKYC = await this.prisma.userKYC.findUnique({
        where: { userId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existingKYC) {
        throw new Error('KYC record not found');
      }

      const updateData: any = {};

      if (body.fullName) {
        updateData.fullName = body.fullName;
      }
      if (body.dateOfBirth) {
        updateData.dateOfBirth = new Date(body.dateOfBirth);
      }
      if (body.nationality) {
        updateData.nationality = body.nationality;
      }
      if (body.address) {
        updateData.address = body.address;
      }
      if (body.kycNumber) {
        updateData.kycNumber = body.kycNumber;
      }
      if (body.kycFileUrl) {
        updateData.kycFileUrl = body.kycFileUrl;
      }

      const kyc = await this.prisma.userKYC.update({
        where: { userId },
        data: {
          ...updateData,
          updatedAt: new Date(),
          status: KycStatus.submitted,
        },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserStatus.kyc_submitted },
      });

      return {
        success: true,
        message: 'KYC updated successfully',
        kycId: kyc.id,
        status: kyc.status,
      };
    } catch (error) {
      this.logger.error('Error updating KYC:', error);
      throw new Error('Failed to update KYC');
    }
  }

  async performKYCAction(
    userId: string,
    action: 'draft' | 'submit' | 'approve' | 'reject',
    message?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const existingKYC = await this.prisma.userKYC.findUnique({
      where: { userId },
    });

    if (!existingKYC) {
      throw new Error('KYC record not found');
    }

    let status: 'pending' | 'submitted' | 'approved' | 'rejected';
    let userStatus:
      | 'pending'
      | 'pending_admin'
      | 'pending_kyc'
      | 'kyc_submitted'
      | 'kyc_changing'
      | 'active'
      | 'inactive';

    switch (action) {
      case 'draft':
        status = 'pending';
        userStatus = 'kyc_changing';
        break;
      case 'submit':
        status = 'submitted';
        userStatus = 'kyc_submitted';
        break;
      case 'approve':
        status = 'approved';
        userStatus = 'active';
        break;
      case 'reject':
        status = 'rejected';
        userStatus = 'inactive';
        break;
      default:
        throw new Error('Invalid KYC action');
    }

    const kyc = await this.prisma.userKYC.update({
      where: { userId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedById: userId,
        message,
      },
    });

    // Update user status
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: userStatus },
    });

    return {
      success: true,
      message: `KYC ${action} successfully`,
      kycId: kyc.id,
      status: kyc.status,
    };
  }

  async getAllKYCSubmissions(query: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [kycSubmissions, total] = await Promise.all([
      this.prisma.userKYC.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              referenceId: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userKYC.count({ where }),
    ]);

    return {
      data: kycSubmissions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getKYCById(id: string) {
    const kyc = await this.prisma.userKYC.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            referenceId: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!kyc) {
      return null;
    }

    return kyc;
  }

  async getKYCByUserId(userId: string) {
    const kyc = await this.prisma.userKYC.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            referenceId: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!kyc) {
      return {};
    }

    return kyc;
  }

  async performKYCActionByAdmin(
    kycId: string,
    action: 'approve' | 'requestChange',
    adminId: string,
    message?: string,
  ) {
    try {
      const kyc = await this.prisma.userKYC.findUnique({
        where: { id: kycId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!kyc) {
        throw new NotFoundException('KYC record not found');
      }

      const admin = await this.prisma.user.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      });

      if (!admin) {
        throw new NotFoundException('Admin not found');
      }

      let updatedKYC;
      let userStatus;

      if (action === 'approve') {
        updatedKYC = await this.prisma.userKYC.update({
          where: { id: kycId },
          data: {
            status: KycStatus.approved,
            reviewedById: adminId,
            reviewedAt: new Date(),
          },
        });

        // Update user status to active
        await this.prisma.user.update({
          where: { id: kyc.userId },
          data: { status: UserStatus.active },
        });

        userStatus = UserStatus.active;
      } else if (action === 'requestChange') {
        updatedKYC = await this.prisma.userKYC.update({
          where: { id: kycId },
          data: {
            status: KycStatus.pending,
            reviewedById: adminId,
            reviewedAt: new Date(),
            message,
          },
        });

        // Update user status to pending_kyc
        await this.prisma.user.update({
          where: { id: kyc.userId },
          data: { status: UserStatus.kyc_changing },
        });

        userStatus = UserStatus.kyc_changing;
      }

      // Create activity log
      const adminJwtPayload: JwtPayload = {
        id: admin.id,
        email: admin.email,
        phoneNumber: '', // Admin phone number not needed for activity log
        referenceId: '', // Admin reference ID not needed for activity log
      };

      await this.activityLogService.createActivityLog(
        kyc.userId,
        ActivityTargetType.USER,
        ActivityType.USER_UPDATED,
        adminJwtPayload,
        `Admin ${admin.fullName} ${action === 'approve' ? 'approved' : 'requested change for'} KYC of user ${kyc.user.fullName}`,
        {
          kycId: kyc.id,
          action,
          adminId,
          message,
          newStatus: updatedKYC.status,
          userStatus,
        },
      );

      if (action === 'approve') {
        await this.mailService.sendAdminApproveKycEmail(
          kyc.user.email,
          kyc.user.fullName,
          admin.fullName,
        );
      } else if (action === 'requestChange') {
        await this.mailService.sendAdminRequestChangeKycEmail(
          kyc.user.email,
          kyc.user.fullName,
          message || '',
          admin.fullName,
        );
      }

      // Emit WebSocket event for KYC status update
      const statusMessage =
        action === 'approve'
          ? `Thông tin KYC của bạn đã được phê duyệt`
          : `Thông tin KYC của bạn cần sự thay đổi. Nhấn vào để thay đổi ngay`;

      // Create notification for the user
      await this.notificationService.createNotification({
        userId: kyc.userId,
        relatedModel: RelatedModel.user,
        relatedModelId: kyc.userId,
        action:
          action === 'approve'
            ? NotificationAction.kyc_approved
            : NotificationAction.kyc_changing,
        message: statusMessage,
        linkUrl: `${action === 'requestChange' ? '/kyc' : ''}`, // Link to KYC page with status
      });

      return {
        success: true,
        message: `KYC ${action === 'approve' ? 'đã được phê duyệt' : 'cần sự thay đổi'} thành công`,
        kycStatus: updatedKYC.status,
        userStatus,
      };
    } catch (error) {
      this.logger.error('Error performing KYC action:', error);
      throw new Error('Failed to perform KYC action');
    }
  }

  // ==================== KYC ACTION SERVICE METHODS ====================

  /**
   * Send KYC reminder email to user
   */
  async sendKYCReminderEmail(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          userConfig: {
            select: {
              config: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user wants to receive emails
      if (user.userConfig) {
        const config = user.userConfig.config as Record<string, any>;
        if (config?.[USER_CONFIG_KEYS.EMAIL_SUBSCRIPTION] === false) {
          throw new Error('User has disabled email notifications');
        }
      }

      const daysSinceLastUpdate = Math.floor(
        (Date.now() - user.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      let reason: string;
      if (daysSinceLastUpdate < 7) {
        reason =
          'Vui lòng hoàn thành thông tin KYC để có thể sử dụng đầy đủ tính năng của hệ thống.';
      } else if (daysSinceLastUpdate < 30) {
        reason = `Tài khoản của bạn đã ở trạng thái chờ KYC ${daysSinceLastUpdate} ngày. Vui lòng cập nhật thông tin để tiếp tục sử dụng dịch vụ.`;
      } else {
        reason = `Tài khoản của bạn đã chưa hoàn thành KYC hơn ${daysSinceLastUpdate} ngày. Vui lòng cập nhật ngay để tránh bị hạn chế tài khoản.`;
      }

      const updateUrl = `${process.env.FRONTEND_URL}/kyc`;

      await this.mailService.sendNotificationUpdateKycEmail(
        user.email,
        user.fullName || 'Người dùng',
        reason,
        updateUrl,
      );

      return {
        success: true,
        message: 'KYC reminder email sent successfully',
      };
    } catch (error) {
      this.logger.error('Error sending KYC reminder email:', error);
      throw new Error('Failed to send KYC reminder email');
    }
  }

  /**
   * Send KYC changing reminder email to user
   */
  async sendKYCChangingReminderEmail(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          userConfig: {
            select: {
              config: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user wants to receive emails
      if (user.userConfig) {
        const config = user.userConfig.config as Record<string, any>;
        if (config?.[USER_CONFIG_KEYS.EMAIL_SUBSCRIPTION] === false) {
          throw new Error('User has disabled email notifications');
        }
      }

      const daysSinceLastUpdate = Math.floor(
        (Date.now() - user.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      let message: string;
      let reviewerName = 'Đội ngũ ACTA';

      if (daysSinceLastUpdate < 3) {
        message =
          'Chúng tôi đã yêu cầu bạn cập nhật thông tin KYC. Vui lòng hoàn tất việc cập nhật để tài khoản của bạn được xử lý nhanh chóng.';
      } else if (daysSinceLastUpdate < 7) {
        message = `Tài khoản của bạn đã ở trạng thái cần sửa đổi KYC ${daysSinceLastUpdate} ngày. Vui lòng cập nhật thông tin sớm nhất để tránh gián đoạn dịch vụ.`;
      } else {
        message = `Tài khoản của bạn đã cần sửa đổi KYC hơn ${daysSinceLastUpdate} ngày. Đây là nhắc nhở cuối cùng - vui lòng cập nhật ngay để tránh bị tạm khóa tài khoản.`;
        reviewerName = 'Bộ phận Kiểm duyệt ACTA';
      }

      const updateUrl = `${process.env.FRONTEND_URL}/kyc`;

      await this.mailService.sendNotificationChangingKycEmail(
        user.email,
        user.fullName || 'Người dùng',
        message,
        reviewerName,
        updateUrl,
      );

      return {
        success: true,
        message: 'KYC changing reminder email sent successfully',
      };
    } catch (error) {
      this.logger.error('Error sending KYC changing reminder email:', error);
      throw new Error('Failed to send KYC changing reminder email');
    }
  }

  /**
   * Send KYC pending notification to admins
   */
  async sendKYCPendingNotificationToAdmins(kycSubmissions: any[]) {
    try {
      // Get all active admin users with their configs
      const adminUsers = await this.prisma.user.findMany({
        where: {
          role: Role.admin,
          status: UserStatus.active,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          userConfig: {
            select: {
              config: true,
            },
          },
        },
      });

      // Filter out admins who don't want to receive email notifications
      const adminsToNotify = adminUsers.filter((admin) => {
        if (!admin.userConfig) {
          return true;
        }

        const config = admin.userConfig.config as Record<string, any>;
        return config?.[USER_CONFIG_KEYS.EMAIL_SUBSCRIPTION] !== false;
      });

      if (adminsToNotify.length === 0) {
        throw new Error('No admin users found to send notifications to');
      }

      // Group KYCs by submission date
      const recentKYCs = kycSubmissions.filter(
        (kyc) =>
          new Date().getTime() - new Date(kyc.createdAt).getTime() <
          24 * 60 * 60 * 1000, // Last 24 hours
      );

      const olderKYCs = kycSubmissions.filter(
        (kyc) =>
          new Date().getTime() - new Date(kyc.createdAt).getTime() >=
          24 * 60 * 60 * 1000, // Older than 24 hours
      );

      const adminDashboardUrl = `${process.env.FRONTEND_DOMAIN}/admin/users`;

      let successCount = 0;
      let errorCount = 0;

      for (const admin of adminsToNotify) {
        try {
          await this.mailService.sendKYCPendingNotificationEmail(
            admin.email,
            admin.fullName,
            kycSubmissions.length,
            recentKYCs.length,
            olderKYCs.length,
            adminDashboardUrl,
          );
          successCount++;
        } catch (emailError) {
          errorCount++;
          this.logger.error(
            `Failed to send KYC notification to admin ${admin.email}:`,
            emailError,
          );
        }
      }

      return {
        success: true,
        message: `KYC notifications sent to ${successCount} admin users`,
        successCount,
        errorCount,
      };
    } catch (error) {
      this.logger.error(
        'Error sending KYC pending notifications to admins:',
        error,
      );
      throw new Error('Failed to send KYC pending notifications to admins');
    }
  }

  /**
   * Get KYC statistics for dashboard
   */
  async getKYCStatistics() {
    try {
      const [
        pendingKYCUsers,
        kycChangingUsers,
        submittedKYCs,
        approvedKYCs,
        rejectedKYCs,
      ] = await Promise.all([
        this.prisma.user.count({
          where: { status: UserStatus.pending_kyc },
        }),
        this.prisma.user.count({
          where: { status: UserStatus.kyc_changing },
        }),
        this.prisma.userKYC.count({
          where: { status: KycStatus.submitted },
        }),
        this.prisma.userKYC.count({
          where: { status: KycStatus.approved },
        }),
        this.prisma.userKYC.count({
          where: { status: KycStatus.rejected },
        }),
      ]);

      return {
        pendingKYCUsers,
        kycChangingUsers,
        submittedKYCs,
        approvedKYCs,
        rejectedKYCs,
        totalKYCs: submittedKYCs + approvedKYCs + rejectedKYCs,
      };
    } catch (error) {
      this.logger.error('Error getting KYC statistics:', error);
      throw new Error('Failed to get KYC statistics');
    }
  }
}
