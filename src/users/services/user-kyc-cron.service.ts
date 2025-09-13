import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  KycStatus,
  NotificationAction,
  RelatedModel,
  Role,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { MailService } from '../../mail/mail.service';
import { NotificationService } from '../../notifications/notification.service';

// Import types, constants, and utilities
import {
  DELAY_CONSTANTS,
  NOTIFICATION_MESSAGES,
  THRESHOLD_CONSTANTS,
  TIME_CONSTANTS,
} from '../constants/cron.constants';
import {
  AncestorUser,
  BirthdayNotificationStats,
  KYCStats,
  KYCUrgencyStats,
  ReferralKYCStats,
  ReferralNotification,
  SubmittedKYC,
  UserWithBirthday,
  UserWithConfig,
  UserWithKYCIssue,
} from '../types/kyc-cron.types';
import {
  calculateDaysUntilBirthday,
  calculateKYCUrgencyStats,
  delay,
  filterUsersForEmailNotification,
  filterUsersWithUpcomingBirthdays,
  formatSuccessRate,
  generateKYCChangingEmailContent,
  generateKYCEmailContent,
  groupUsersByKYCStatus,
} from '../utils/kyc-cron.utils';

@Injectable()
export class UserKYCCronService {
  private readonly logger = new Logger(UserKYCCronService.name);
  private isKYCSubmittedCheckRunning = false;
  private isKYCReminderRunning = false;
  private isKYCChangingReminderRunning = false;
  private isReferralKYCNotificationRunning = false;
  private isBirthdayNotificationRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
  ) {}

  // ==================== KYC SUBMITTED CHECK (Daily at 9:00 AM) ====================
  @Cron('0 9 * * *')
  async handleKYCSubmittedCheck(): Promise<void> {
    const jobId = `kyc-submitted-check-${Date.now()}`;
    const processId = process.pid;

    if (this.isKYCSubmittedCheckRunning) {
      this.logger.warn(
        `[PID:${processId}][${jobId}] KYC submitted check is already running, skipping...`,
      );
      return;
    }

    this.isKYCSubmittedCheckRunning = true;
    this.logger.log(
      `[PID:${processId}][${jobId}] Starting KYC submitted check...`,
    );

    try {
      const submittedKYCs = await this.getSubmittedKYCs();
      this.logger.log(
        `[PID:${processId}][${jobId}] Found ${submittedKYCs.length} submitted KYC records`,
      );

      if (submittedKYCs.length > 0) {
        await this.notifyAdminsAboutPendingKYCs(submittedKYCs);
        await this.checkStaleKYCSubmissions(submittedKYCs);
      }

      this.logger.log(
        `[PID:${processId}][${jobId}] KYC submitted check completed successfully`,
      );
    } catch (error) {
      this.logger.error(
        `[PID:${processId}][${jobId}] Error in KYC submitted check:`,
        error,
      );
    } finally {
      this.isKYCSubmittedCheckRunning = false;
      this.logger.log(
        `[PID:${processId}][${jobId}] KYC submitted check job finished`,
      );
    }
  }

  // ==================== KYC REMINDER (Weekly on Sunday at 9:00 AM) ====================
  @Cron('0 9 * * 0')
  async handleKYCReminder(): Promise<void> {
    if (this.isKYCReminderRunning) {
      this.logger.warn('KYC reminder is already running, skipping...');
      return;
    }

    this.isKYCReminderRunning = true;
    this.logger.log('Starting KYC reminder email job...');

    try {
      const pendingKYCUsers = await this.getPendingKYCUsers();
      const usersToNotify = filterUsersForEmailNotification(pendingKYCUsers);

      this.logger.log(
        `Found ${pendingKYCUsers.length} pending KYC users, ${usersToNotify.length} will receive reminders`,
      );

      if (usersToNotify.length === 0) {
        this.logger.log(
          'No pending KYC users found or all have disabled email notifications. Job completed.',
        );
        return;
      }

      const stats = await this.sendKYCEmails(
        usersToNotify,
        this.sendKYCReminderEmail.bind(this),
      );
      await this.logKYCReminderStats(stats);
    } catch (error) {
      this.logger.error('Error in KYC reminder job:', error);
    } finally {
      this.isKYCReminderRunning = false;
    }
  }

  // ==================== KYC CHANGING REMINDER (Daily at 10:00 AM) ====================
  @Cron('0 10 * * *')
  async handleKYCChangingReminder(): Promise<void> {
    if (this.isKYCChangingReminderRunning) {
      this.logger.warn('KYC changing reminder is already running, skipping...');
      return;
    }

    this.isKYCChangingReminderRunning = true;
    this.logger.log('Starting KYC changing reminder email job...');

    try {
      const kycChangingUsers = await this.getKYCChangingUsers();
      const usersToNotify = filterUsersForEmailNotification(kycChangingUsers);

      this.logger.log(
        `Found ${kycChangingUsers.length} kyc_changing users, ${usersToNotify.length} will receive reminders`,
      );

      if (usersToNotify.length === 0) {
        this.logger.log(
          'No kyc_changing users found or all have disabled email notifications. Job completed.',
        );
        return;
      }

      const stats = await this.sendKYCEmails(
        usersToNotify,
        this.sendKYCChangingReminderEmail.bind(this),
      );
      await this.logKYCChangingReminderStats(stats);
    } catch (error) {
      this.logger.error('Error in KYC changing reminder job:', error);
    } finally {
      this.isKYCChangingReminderRunning = false;
    }
  }

  // ==================== REFERRAL KYC NOTIFICATION (Daily at 11:00 AM) ====================
  @Cron('0 11 * * *')
  async handleReferralKYCNotification(): Promise<void> {
    if (this.isReferralKYCNotificationRunning) {
      this.logger.warn(
        'Referral KYC notification is already running, skipping...',
      );
      return;
    }

    this.isReferralKYCNotificationRunning = true;
    this.logger.log('Starting referral KYC notification job...');

    try {
      const usersWithKYCIssues = await this.getUsersWithKYCIssues();
      const { pending, changing } = groupUsersByKYCStatus(usersWithKYCIssues);

      this.logger.log(
        `Found ${usersWithKYCIssues.length} users with KYC issues (pending_kyc: ${pending.length}, kyc_changing: ${changing.length})`,
      );

      if (usersWithKYCIssues.length === 0) {
        this.logger.log('No users with KYC issues found. Job completed.');
        return;
      }

      const referralClosures =
        await this.getDirectReferralClosures(usersWithKYCIssues);
      const notificationsByAncestor = this.groupNotificationsByAncestor(
        referralClosures,
        usersWithKYCIssues,
      );
      const ancestorUsers = await this.getAncestorUsers(
        notificationsByAncestor,
      );

      this.logger.log(
        `Found ${ancestorUsers.length} ancestor users to create notifications for`,
      );

      const stats = await this.createReferralNotifications(
        ancestorUsers,
        notificationsByAncestor,
      );
      await this.logReferralKYCNotificationStats(
        stats,
        usersWithKYCIssues.length,
      );
    } catch (error) {
      this.logger.error('Error in referral KYC notification job:', error);
    } finally {
      this.isReferralKYCNotificationRunning = false;
    }
  }

  // ==================== BIRTHDAY NOTIFICATION (Daily at 12:00 AM) ====================
  @Cron('0 0 * * *')
  async handleBirthdayNotification(): Promise<void> {
    if (this.isBirthdayNotificationRunning) {
      this.logger.warn('Birthday notification is already running, skipping...');
      return;
    }

    this.isBirthdayNotificationRunning = true;
    this.logger.log('Starting birthday notification job...');

    try {
      const usersWithUpcomingBirthdays =
        await this.getUsersWithUpcomingBirthdays();

      this.logger.log(
        `Found ${usersWithUpcomingBirthdays.length} users with upcoming birthdays in ${THRESHOLD_CONSTANTS.BIRTHDAY_REMINDER_DAYS} days`,
      );

      if (usersWithUpcomingBirthdays.length === 0) {
        this.logger.log(
          'No users with upcoming birthdays found. Job completed.',
        );
        return;
      }

      const stats = await this.processBirthdayNotifications(
        usersWithUpcomingBirthdays,
      );
      await this.logBirthdayNotificationStats(stats);
    } catch (error) {
      this.logger.error('Error in birthday notification job:', error);
    } finally {
      this.isBirthdayNotificationRunning = false;
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async getSubmittedKYCs(): Promise<SubmittedKYC[]> {
    return await this.prisma.userKYC.findMany({
      where: { status: KycStatus.submitted },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            referenceId: true,
            status: true,
          },
        },
      },
    });
  }

  private async getPendingKYCUsers(): Promise<UserWithConfig[]> {
    return await this.prisma.user.findMany({
      where: { status: UserStatus.pending_kyc },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        userConfig: {
          select: {
            id: true,
            config: true,
          },
        },
      },
    });
  }

  private async getKYCChangingUsers(): Promise<UserWithConfig[]> {
    return await this.prisma.user.findMany({
      where: { status: UserStatus.kyc_changing },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        userConfig: {
          select: {
            id: true,
            config: true,
          },
        },
      },
    });
  }

  private async getUsersWithKYCIssues(): Promise<UserWithKYCIssue[]> {
    return await this.prisma.user.findMany({
      where: {
        status: {
          in: [UserStatus.pending_kyc, UserStatus.kyc_changing],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        referenceId: true,
        status: true,
      },
    });
  }

  private async getDirectReferralClosures(
    usersWithKYCIssues: UserWithKYCIssue[],
  ) {
    return await this.prisma.userReferralClosure.findMany({
      where: {
        descendantId: {
          in: usersWithKYCIssues.map((user) => user.referenceId),
        },
        depth: 1, // Only direct referrals
      },
      select: {
        ancestorId: true,
        descendantId: true,
        depth: true,
      },
    });
  }

  private groupNotificationsByAncestor(
    referralClosures: any[],
    usersWithKYCIssues: UserWithKYCIssue[],
  ): Map<string, ReferralNotification[]> {
    const notificationsByAncestor = new Map<string, ReferralNotification[]>();

    for (const closure of referralClosures) {
      const userWithIssue = usersWithKYCIssues.find(
        (user) => user.referenceId === closure.descendantId,
      );

      if (userWithIssue) {
        if (!notificationsByAncestor.has(closure.ancestorId)) {
          notificationsByAncestor.set(closure.ancestorId, []);
        }
        notificationsByAncestor.get(closure.ancestorId)!.push({
          descendantId: closure.descendantId,
          depth: closure.depth,
          userWithIssue,
        });
      }
    }

    return notificationsByAncestor;
  }

  private async getAncestorUsers(
    notificationsByAncestor: Map<string, ReferralNotification[]>,
  ): Promise<AncestorUser[]> {
    const ancestorIds = Array.from(notificationsByAncestor.keys());
    return await this.prisma.user.findMany({
      where: { referenceId: { in: ancestorIds } },
      select: {
        id: true,
        fullName: true,
        email: true,
        referenceId: true,
      },
    });
  }

  private async sendKYCEmails(
    users: UserWithConfig[],
    emailSender: (user: UserWithConfig) => Promise<void>,
  ): Promise<KYCStats> {
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        await emailSender(user);
        successCount++;
        this.logger.log(`✅ Sent email to ${user.fullName} (${user.email})`);
        await delay(DELAY_CONSTANTS.EMAIL_DELAY);
      } catch (error) {
        errorCount++;
        this.logger.error(
          `❌ Failed to send email to ${user.fullName} (${user.email}):`,
          error,
        );
      }
    }

    return {
      total: users.length,
      success: successCount,
      failed: errorCount,
      successRate: formatSuccessRate(users.length, successCount),
    };
  }

  private async createReferralNotifications(
    ancestorUsers: AncestorUser[],
    notificationsByAncestor: Map<string, ReferralNotification[]>,
  ): Promise<KYCStats> {
    let successCount = 0;
    let errorCount = 0;

    for (const ancestor of ancestorUsers) {
      try {
        const notifications =
          notificationsByAncestor.get(ancestor.referenceId) || [];
        await this.createReferralKYCNotification(ancestor, notifications);
        successCount++;
        this.logger.log(
          `✅ Created referral KYC notification for ${ancestor.fullName} (${ancestor.email}) - Direct referrals: ${notifications.length}`,
        );
        await delay(DELAY_CONSTANTS.NOTIFICATION_DELAY);
      } catch (error) {
        errorCount++;
        this.logger.error(
          `❌ Failed to create referral KYC notification for ${ancestor.fullName} (${ancestor.email}):`,
          error,
        );
      }
    }

    return {
      total: ancestorUsers.length,
      success: successCount,
      failed: errorCount,
      successRate: formatSuccessRate(ancestorUsers.length, successCount),
    };
  }

  private async notifyAdminsAboutPendingKYCs(
    submittedKYCs: SubmittedKYC[],
  ): Promise<void> {
    const processId = process.pid;
    const timestamp = new Date().toISOString();

    this.logger.log(
      `[PID:${processId}][${timestamp}] Notifying admins about ${submittedKYCs.length} pending KYC submissions`,
    );

    try {
      const adminUsers = await this.getAdminUsers();
      const adminsToNotify = filterUsersForEmailNotification(adminUsers);

      this.logger.log(
        `[PID:${processId}][${timestamp}] Found ${adminUsers.length} active admins, ${adminsToNotify.length} will receive notifications`,
      );

      if (adminsToNotify.length === 0) {
        this.logger.warn(
          `[PID:${processId}][${timestamp}] No admin users found to send notifications to (all have disabled email notifications)`,
        );
        return;
      }

      const { recentKYCs, olderKYCs } = this.categorizeKYCsByAge(submittedKYCs);
      await this.sendAdminNotifications(
        adminsToNotify,
        submittedKYCs.length,
        recentKYCs.length,
        olderKYCs.length,
      );
    } catch (error) {
      this.logger.error(
        `[PID:${processId}][${timestamp}] Failed to notify admins about pending KYCs:`,
        error,
      );
    }
  }

  private async getAdminUsers() {
    return await this.prisma.user.findMany({
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
            id: true,
            config: true,
          },
        },
      },
    });
  }

  private categorizeKYCsByAge(submittedKYCs: SubmittedKYC[]) {
    const now = Date.now();
    const recentKYCs = submittedKYCs.filter(
      (kyc) => now - new Date(kyc.createdAt).getTime() < TIME_CONSTANTS.ONE_DAY,
    );
    const olderKYCs = submittedKYCs.filter(
      (kyc) =>
        now - new Date(kyc.createdAt).getTime() >= TIME_CONSTANTS.ONE_DAY,
    );
    return { recentKYCs, olderKYCs };
  }

  private async sendAdminNotifications(
    adminsToNotify: any[],
    totalKYCs: number,
    recentKYCs: number,
    olderKYCs: number,
  ): Promise<void> {
    const adminDashboardUrl = `${process.env.FRONTEND_DOMAIN}/admin/users`;

    for (const admin of adminsToNotify) {
      try {
        await this.mailService.sendKYCPendingNotificationEmail(
          admin.email,
          admin.fullName,
          totalKYCs,
          recentKYCs,
          olderKYCs,
          adminDashboardUrl,
        );
      } catch (emailError) {
        this.logger.error(
          `Failed to send KYC notification to admin ${admin.email}:`,
          emailError,
        );
      }
    }

    const processId = process.pid;
    const timestamp = new Date().toISOString();

    this.logger.log(
      `[PID:${processId}][${timestamp}] KYC notifications sent to ${adminsToNotify.length} admin users`,
    );
  }

  private async checkStaleKYCSubmissions(
    submittedKYCs: SubmittedKYC[],
  ): Promise<void> {
    try {
      const now = Date.now();
      const staleKYCs = submittedKYCs.filter(
        (kyc) =>
          now - new Date(kyc.createdAt).getTime() > TIME_CONSTANTS.ONE_WEEK,
      );

      if (staleKYCs.length > 0) {
        this.logger.warn(
          `Found ${staleKYCs.length} stale KYC submissions (>7 days old)`,
        );
        this.logStaleKYCDetails(staleKYCs, now);
      }
    } catch (error) {
      this.logger.error('Error checking stale KYC submissions:', error);
    }
  }

  private logStaleKYCDetails(staleKYCs: SubmittedKYC[], now: number): void {
    staleKYCs.forEach((kyc) => {
      const daysSinceSubmission = Math.floor(
        (now - new Date(kyc.createdAt).getTime()) / TIME_CONSTANTS.ONE_DAY,
      );
      this.logger.warn(
        `Stale KYC: User ${kyc.user.fullName} (${kyc.user.referenceId}) submitted ${daysSinceSubmission} days ago`,
      );
    });
  }

  private async sendKYCReminderEmail(user: UserWithConfig): Promise<void> {
    const { reason, updateUrl } = generateKYCEmailContent(user);
    await this.mailService.sendNotificationUpdateKycEmail(
      user.email,
      user.fullName || 'Người dùng',
      reason,
      updateUrl,
    );
  }

  private async sendKYCChangingReminderEmail(
    user: UserWithConfig,
  ): Promise<void> {
    const { message, reviewerName, updateUrl } =
      generateKYCChangingEmailContent(user);
    await this.mailService.sendNotificationChangingKycEmail(
      user.email,
      user.fullName || 'Người dùng',
      message,
      reviewerName,
      updateUrl,
    );
  }

  private async createReferralKYCNotification(
    ancestor: AncestorUser,
    notifications: ReferralNotification[],
  ): Promise<void> {
    const { pending, changing } = groupUsersByKYCStatus(
      notifications.map((n) => n.userWithIssue),
    );

    let message = '';
    let action: NotificationAction;

    if (pending.length > 0 && changing.length > 0) {
      message = NOTIFICATION_MESSAGES.REFERRAL_KYC.BOTH(
        pending.length,
        changing.length,
      );
      action = NotificationAction.kyc_changing;
    } else if (pending.length > 0) {
      message = NOTIFICATION_MESSAGES.REFERRAL_KYC.PENDING_ONLY(pending.length);
      action = NotificationAction.kyc_changing;
    } else if (changing.length > 0) {
      message = NOTIFICATION_MESSAGES.REFERRAL_KYC.CHANGING_ONLY(
        changing.length,
      );
      action = NotificationAction.kyc_changing;
    } else {
      return; // No notifications to create
    }

    await this.notificationService.createNotification({
      userId: ancestor.id,
      relatedModel: RelatedModel.user,
      relatedModelId: ancestor.id,
      action: action,
      message: message,
      linkUrl: '',
    });
  }

  private async logKYCReminderStats(stats: KYCStats): Promise<void> {
    const logStats = {
      timestamp: new Date(),
      totalPendingUsers: stats.total,
      emailsSent: stats.success,
      emailsFailed: stats.failed,
      successRate: stats.successRate,
    };
    this.logger.log(
      `📈 KYC Reminder Stats: ${JSON.stringify(logStats, null, 2)}`,
    );
  }

  private async logKYCChangingReminderStats(stats: KYCStats): Promise<void> {
    const logStats = {
      timestamp: new Date(),
      totalKycChangingUsers: stats.total,
      emailsSent: stats.success,
      emailsFailed: stats.failed,
      successRate: stats.successRate,
    };
    this.logger.log(
      `📈 KYC Changing Reminder Stats: ${JSON.stringify(logStats, null, 2)}`,
    );
  }

  private async logReferralKYCNotificationStats(
    stats: KYCStats,
    usersWithIssues: number,
  ): Promise<void> {
    const logStats = {
      timestamp: new Date(),
      totalAncestorUsers: stats.total,
      notificationsCreated: stats.success,
      notificationsFailed: stats.failed,
      usersWithKYCIssues: usersWithIssues,
      successRate: stats.successRate,
    };
    this.logger.log(
      `📈 Referral KYC Notification Stats: ${JSON.stringify(logStats, null, 2)}`,
    );
  }

  // ==================== MANUAL TRIGGER METHODS ====================

  async triggerKYCSubmittedCheck(): Promise<void> {
    this.logger.log('🔧 Manual KYC submitted check trigger initiated');
    await this.handleKYCSubmittedCheck();
  }

  async triggerKYCReminder(): Promise<void> {
    this.logger.log('🔧 Manual KYC reminder trigger initiated');
    await this.handleKYCReminder();
  }

  async triggerKYCChangingReminder(): Promise<void> {
    this.logger.log('🔧 Manual KYC changing reminder trigger initiated');
    await this.handleKYCChangingReminder();
  }

  async triggerReferralKYCNotification(): Promise<void> {
    this.logger.log('🔧 Manual referral KYC notification trigger initiated');
    await this.handleReferralKYCNotification();
  }

  // ==================== UTILITY METHODS ====================

  async getPendingKYCUsersCount(): Promise<number> {
    const users = await this.getPendingKYCUsers();
    return filterUsersForEmailNotification(users).length;
  }

  async getKYCChangingUsersCount(): Promise<number> {
    const users = await this.getKYCChangingUsers();
    return filterUsersForEmailNotification(users).length;
  }

  async getPendingKYCUsersForReminder(
    daysThreshold: number = THRESHOLD_CONSTANTS.KYC_REMINDER_DAYS,
  ) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await this.prisma.user.findMany({
      where: {
        status: UserStatus.pending_kyc,
        updatedAt: { lte: thresholdDate },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getStaleKYCChangingUsers(
    daysThreshold: number = THRESHOLD_CONSTANTS.KYC_CHANGING_REMINDER_DAYS,
  ) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    return await this.prisma.user.findMany({
      where: {
        status: UserStatus.kyc_changing,
        updatedAt: { lte: thresholdDate },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getKYCChangingUrgencyStats(): Promise<KYCUrgencyStats> {
    const users = await this.prisma.user.findMany({
      where: { status: UserStatus.kyc_changing },
      select: { id: true, updatedAt: true },
    });

    return calculateKYCUrgencyStats(users);
  }

  async getReferralKYCNotificationStats(): Promise<ReferralKYCStats> {
    try {
      const usersWithKYCIssues = await this.getUsersWithKYCIssues();
      const referralClosures =
        await this.getDirectReferralClosures(usersWithKYCIssues);
      const uniqueAncestors = new Set(
        referralClosures.map((c) => c.ancestorId),
      );
      const { pending, changing } = groupUsersByKYCStatus(usersWithKYCIssues);

      return {
        usersWithKYCIssues: usersWithKYCIssues.length,
        pendingKYCUsers: pending.length,
        kycChangingUsers: changing.length,
        totalDirectReferralRelationships: referralClosures.length,
        uniqueAncestorsToNotify: uniqueAncestors.size,
      };
    } catch (error) {
      this.logger.error(
        'Error getting referral KYC notification stats:',
        error,
      );
      throw new Error('Failed to get referral KYC notification stats');
    }
  }

  // ==================== BIRTHDAY NOTIFICATION METHODS ====================

  /**
   * Get users with upcoming birthdays within the threshold
   */
  private async getUsersWithUpcomingBirthdays(): Promise<UserWithBirthday[]> {
    const users = await this.prisma.user.findMany({
      where: {
        dob: { not: null },
        status: {
          in: [
            UserStatus.active,
            UserStatus.kyc_changing,
            UserStatus.kyc_submitted,
          ],
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        referenceId: true,
        dob: true,
        status: true,
      },
    });

    return filterUsersWithUpcomingBirthdays(
      users.filter((user) => user.dob !== null) as UserWithBirthday[],
      THRESHOLD_CONSTANTS.BIRTHDAY_REMINDER_DAYS,
    );
  }

  /**
   * Process birthday notifications for all users with upcoming birthdays
   * Uses referral closure table for efficient querying
   */
  private async processBirthdayNotifications(
    usersWithUpcomingBirthdays: UserWithBirthday[],
  ): Promise<BirthdayNotificationStats> {
    const stats: BirthdayNotificationStats = {
      totalUsersWithUpcomingBirthdays: usersWithUpcomingBirthdays.length,
      totalNotificationsSent: 0,
      notificationsByType: {
        referrer: 0,
        directReferral: 0,
        indirectReferral: 0,
      },
      success: 0,
      failed: 0,
      successRate: '0%',
    };

    if (usersWithUpcomingBirthdays.length === 0) {
      return stats;
    }

    try {
      // Get all referral relationships for birthday users using closure table
      const birthdayUserReferenceIds = usersWithUpcomingBirthdays.map(
        (user) => user.referenceId,
      );

      // Get all referral closures for birthday users (both as ancestors and descendants)
      const [ancestorClosures, descendantClosures] = await Promise.all([
        // Users who have the birthday users in their referral tree (will receive notifications)
        this.prisma.userReferralClosure.findMany({
          where: {
            descendantId: { in: birthdayUserReferenceIds },
            depth: { gt: 0 }, // Exclude self-references
          },
          include: {
            ancestor: {
              select: {
                id: true,
                fullName: true,
                email: true,
                referenceId: true,
                isActive: true,
              },
            },
            descendant: {
              select: {
                id: true,
                fullName: true,
                referenceId: true,
              },
            },
          },
        }),
        // Users in the birthday users' referral trees (will receive notifications)
        this.prisma.userReferralClosure.findMany({
          where: {
            ancestorId: { in: birthdayUserReferenceIds },
            depth: { gt: 0 }, // Exclude self-references
          },
          include: {
            ancestor: {
              select: {
                id: true,
                fullName: true,
                referenceId: true,
              },
            },
            descendant: {
              select: {
                id: true,
                fullName: true,
                email: true,
                referenceId: true,
                isActive: true,
              },
            },
          },
        }),
      ]);

      // Process notifications for each birthday user
      for (const birthdayUser of usersWithUpcomingBirthdays) {
        try {
          const daysUntilBirthday = calculateDaysUntilBirthday(
            birthdayUser.dob,
          );

          // Find referrer (ancestor with depth 1 where birthday user is descendant)
          const referrerClosure = ancestorClosures.find(
            (closure) =>
              closure.descendantId === birthdayUser.referenceId &&
              closure.depth === 1 &&
              closure.ancestor.isActive,
          );

          if (referrerClosure) {
            await this.createBirthdayNotification(
              referrerClosure.ancestor.id,
              birthdayUser,
              daysUntilBirthday,
              'referrer',
            );
            stats.notificationsByType.referrer++;
            stats.totalNotificationsSent++;
          }

          // Find direct referrals (descendants with depth 1 where birthday user is ancestor)
          const directReferralClosures = descendantClosures.filter(
            (closure) =>
              closure.ancestorId === birthdayUser.referenceId &&
              closure.depth === 1 &&
              closure.descendant.isActive,
          );

          for (const closure of directReferralClosures) {
            await this.createBirthdayNotification(
              closure.descendant.id,
              birthdayUser,
              daysUntilBirthday,
              'direct_referral',
            );
            stats.notificationsByType.directReferral++;
            stats.totalNotificationsSent++;
          }

          // Find indirect referrals (descendants with depth > 1 where birthday user is ancestor)
          const indirectReferralClosures = descendantClosures.filter(
            (closure) =>
              closure.ancestorId === birthdayUser.referenceId &&
              closure.depth > 1 &&
              closure.descendant.isActive,
          );

          for (const closure of indirectReferralClosures) {
            await this.createBirthdayNotification(
              closure.descendant.id,
              birthdayUser,
              daysUntilBirthday,
              'indirect_referral',
            );
            stats.notificationsByType.indirectReferral++;
            stats.totalNotificationsSent++;
          }

          stats.success++;
          await delay(DELAY_CONSTANTS.NOTIFICATION_DELAY);
        } catch (error) {
          this.logger.error(
            `Error processing birthday notifications for user ${birthdayUser.id}:`,
            error,
          );
          stats.failed++;
        }
      }
    } catch (error) {
      this.logger.error('Error in birthday notification processing:', error);
      stats.failed = usersWithUpcomingBirthdays.length;
    }

    stats.successRate = formatSuccessRate(
      usersWithUpcomingBirthdays.length,
      stats.success,
    );

    return stats;
  }

  /**
   * Create birthday notification for a user
   */
  private async createBirthdayNotification(
    recipientId: string,
    birthdayUser: UserWithBirthday,
    daysUntilBirthday: number,
    relationshipType: 'referrer' | 'direct_referral' | 'indirect_referral',
  ): Promise<void> {
    let message: string;

    switch (relationshipType) {
      case 'referrer':
        message = NOTIFICATION_MESSAGES.BIRTHDAY_REMINDER.REFERRER(
          birthdayUser.fullName,
          daysUntilBirthday,
        );
        break;
      case 'direct_referral':
        message = NOTIFICATION_MESSAGES.BIRTHDAY_REMINDER.DIRECT_REFERRAL(
          birthdayUser.fullName,
          daysUntilBirthday,
        );
        break;
      case 'indirect_referral':
        message = NOTIFICATION_MESSAGES.BIRTHDAY_REMINDER.INDIRECT_REFERRAL(
          birthdayUser.fullName,
          daysUntilBirthday,
        );
        break;
    }

    await this.notificationService.createNotification({
      userId: recipientId,
      message,
      relatedModel: RelatedModel.user,
      relatedModelId: birthdayUser.id,
      action: NotificationAction.system_alert, // TODO: Use NotificationAction.birthday_reminder after running prisma generate
    });
  }

  /**
   * Log birthday notification statistics
   */
  private async logBirthdayNotificationStats(
    stats: BirthdayNotificationStats,
  ): Promise<void> {
    this.logger.log('=== BIRTHDAY NOTIFICATION STATS ===');
    this.logger.log(
      `Total users with upcoming birthdays: ${stats.totalUsersWithUpcomingBirthdays}`,
    );
    this.logger.log(
      `Total notifications sent: ${stats.totalNotificationsSent}`,
    );
    this.logger.log(`Notifications by type:`);
    this.logger.log(
      `  - Referrer notifications: ${stats.notificationsByType.referrer}`,
    );
    this.logger.log(
      `  - Direct referral notifications: ${stats.notificationsByType.directReferral}`,
    );
    this.logger.log(
      `  - Indirect referral notifications: ${stats.notificationsByType.indirectReferral}`,
    );
    this.logger.log(`Success: ${stats.success}, Failed: ${stats.failed}`);
    this.logger.log(`Success rate: ${stats.successRate}%`);
    this.logger.log('=== END BIRTHDAY NOTIFICATION STATS ===');
  }

  /**
   * Trigger birthday notification manually
   */
  async triggerBirthdayNotification(): Promise<void> {
    await this.handleBirthdayNotification();
  }

  /**
   * Get birthday notification statistics
   */
  async getBirthdayNotificationStats(): Promise<BirthdayNotificationStats> {
    try {
      const usersWithUpcomingBirthdays =
        await this.getUsersWithUpcomingBirthdays();

      // Calculate potential notifications
      let totalPotentialNotifications = 0;
      const notificationsByType = {
        referrer: 0,
        directReferral: 0,
        indirectReferral: 0,
      };

      if (usersWithUpcomingBirthdays.length > 0) {
        // Use closure table for efficient counting
        const birthdayUserReferenceIds = usersWithUpcomingBirthdays.map(
          (user) => user.referenceId,
        );

        const [ancestorClosures, descendantClosures] = await Promise.all([
          // Count referrers (ancestors with depth 1)
          this.prisma.userReferralClosure.findMany({
            where: {
              descendantId: { in: birthdayUserReferenceIds },
              depth: 1,
            },
            include: {
              ancestor: { select: { isActive: true } },
            },
          }),
          // Count referrals (descendants with any depth > 0)
          this.prisma.userReferralClosure.findMany({
            where: {
              ancestorId: { in: birthdayUserReferenceIds },
              depth: { gt: 0 },
            },
            include: {
              descendant: { select: { isActive: true } },
            },
          }),
        ]);

        // Count referrers
        notificationsByType.referrer = ancestorClosures.filter(
          (closure) => closure.ancestor.isActive,
        ).length;
        totalPotentialNotifications += notificationsByType.referrer;

        // Count direct and indirect referrals
        const activeDescendantClosures = descendantClosures.filter(
          (closure) => closure.descendant.isActive,
        );

        notificationsByType.directReferral = activeDescendantClosures.filter(
          (closure) => closure.depth === 1,
        ).length;

        notificationsByType.indirectReferral = activeDescendantClosures.filter(
          (closure) => closure.depth > 1,
        ).length;

        totalPotentialNotifications +=
          notificationsByType.directReferral +
          notificationsByType.indirectReferral;
      }

      return {
        totalUsersWithUpcomingBirthdays: usersWithUpcomingBirthdays.length,
        totalNotificationsSent: totalPotentialNotifications,
        notificationsByType,
        success: usersWithUpcomingBirthdays.length,
        failed: 0,
        successRate: '100%',
      };
    } catch (error) {
      this.logger.error('Error getting birthday notification stats:', error);
      throw new Error('Failed to get birthday notification stats');
    }
  }
}
