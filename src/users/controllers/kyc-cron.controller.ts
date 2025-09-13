import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { UserKYCCronService } from '../services/user-kyc-cron.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('kyc-cron')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KYCCronController {
  constructor(private readonly userKYCCronService: UserKYCCronService) {}

  @Post('trigger/kyc-submitted-check')
  @Roles(Role.ADMIN)
  async triggerKYCSubmittedCheck() {
    await this.userKYCCronService.triggerKYCSubmittedCheck();
    return {
      success: true,
      message: 'KYC submitted check triggered successfully',
    };
  }

  @Post('trigger/kyc-reminder')
  @Roles(Role.ADMIN)
  async triggerKYCReminder() {
    await this.userKYCCronService.triggerKYCReminder();
    return {
      success: true,
      message: 'KYC reminder triggered successfully',
    };
  }

  @Post('trigger/kyc-changing-reminder')
  @Roles(Role.ADMIN)
  async triggerKYCChangingReminder() {
    await this.userKYCCronService.triggerKYCChangingReminder();
    return {
      success: true,
      message: 'KYC changing reminder triggered successfully',
    };
  }

  @Post('trigger/referral-kyc-notification')
  @Roles(Role.ADMIN)
  async triggerReferralKYCNotification() {
    await this.userKYCCronService.triggerReferralKYCNotification();
    return {
      success: true,
      message: 'Referral KYC notification triggered successfully',
    };
  }

  @Get('stats/kyc-submitted')
  @Roles(Role.ADMIN)
  async getKYCSubmittedStats() {
    const stats = await this.userKYCCronService.getKYCChangingUrgencyStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('stats/referral-kyc')
  @Roles(Role.ADMIN)
  async getReferralKYCStats() {
    const stats =
      await this.userKYCCronService.getReferralKYCNotificationStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('stats/pending-kyc-count')
  @Roles(Role.ADMIN)
  async getPendingKYCUsersCount() {
    const count = await this.userKYCCronService.getPendingKYCUsersCount();
    return {
      success: true,
      data: { count },
    };
  }

  @Get('stats/kyc-changing-count')
  @Roles(Role.ADMIN)
  async getKYCChangingUsersCount() {
    const count = await this.userKYCCronService.getKYCChangingUsersCount();
    return {
      success: true,
      data: { count },
    };
  }

  @Post('trigger/birthday-notification')
  @Roles(Role.ADMIN)
  async triggerBirthdayNotification() {
    await this.userKYCCronService.triggerBirthdayNotification();
    return {
      success: true,
      message: 'Birthday notification triggered successfully',
    };
  }

  @Get('stats/birthday-notification')
  @Roles(Role.ADMIN)
  async getBirthdayNotificationStats() {
    const stats = await this.userKYCCronService.getBirthdayNotificationStats();
    return {
      success: true,
      data: stats,
    };
  }
}
