import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KycStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { MailService } from '../../mail/mail.service';
import { messages } from '../../constants/messages';

@Injectable()
export class UserActionService {
  private readonly logger = new Logger(UserActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async requestAction(
    id: string,
    requestAction: string,
    reason: string = '',
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      if (!user) throw new NotFoundException(messages.userNotFound);
      const currentTime = new Date();

      if (requestAction === 'approve') {
        await this.prisma.user.update({
          where: { id },
          data: { status: UserStatus.pending_kyc, updatedAt: currentTime },
        });
        await this.mailService.sendAdminApproveAccountEmail(
          user.email,
          user.fullName,
          currentTime,
        );
      } else if (requestAction === 'reject' && reason) {
        await this.prisma.user.update({
          where: { id },
          data: {
            status: UserStatus.inactive,
            rejectedReason: reason,
            updatedAt: currentTime,
          },
        });
        await this.mailService.sendAdminRejectAccountEmail(
          user.email,
          user.fullName,
          reason,
          currentTime,
        );
      } else if (requestAction === 'requestChange' && reason) {
        await this.prisma.user.update({
          where: { id },
          data: {
            status: UserStatus.pending_admin,
            rejectedReason: reason,
            updatedAt: currentTime,
          },
        });
        await this.mailService.sendAdminRequestChangeAccountEmail(
          user.email,
          user.fullName,
          reason,
          currentTime,
        );
      } else {
        throw new BadRequestException(messages.invalidRequestAction);
      }
      return {
        message: messages.userActionRequestedSuccessfully,
      };
    } catch (error) {
      this.logger.error('Error requesting action:', error);
      throw new InternalServerErrorException(
        messages.userActionRequestedFailed,
      );
    }
  }

  async referrerAction(
    userId: string,
    referrerId: string,
    requestAction: string,
    reason: string = '',
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          referrer: true,
        },
      });
      if (!user) throw new NotFoundException(messages.userNotFound);
      if (user.referrer?.id !== referrerId) {
        throw new BadRequestException(messages.userNotReferrer);
      }
      const currentTime = new Date();
      if (requestAction === 'approve') {
        await this.prisma.user.update({
          where: { id: userId },
          data: { status: UserStatus.pending_kyc, updatedAt: currentTime },
        });
        await this.mailService.sendReferrerApproveAccountEmail(
          user.email,
          user.fullName,
          user.referrer.fullName,
          currentTime,
        );
      } else if (requestAction === 'reject' && reason) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.inactive,
            rejectedReason: reason,
            updatedAt: currentTime,
          },
        });
        await this.mailService.sendReferrerRejectAccountEmail(
          user.email,
          user.fullName,
          user.referrer.fullName,
          reason,
          currentTime,
        );
      } else if (requestAction === 'requestChange' && reason) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.pending_admin,
            rejectedReason: reason,
            updatedAt: currentTime,
          },
        });
        await this.mailService.sendReferrerRequestChangeAccountEmail(
          user.email,
          user.fullName,
          user.referrer.fullName,
          reason,
          currentTime,
        );
      } else {
        throw new BadRequestException(messages.invalidRequestAction);
      }
      return { userId };
    } catch (error) {
      this.logger.error('Error requesting action:', error);
      throw new InternalServerErrorException(
        messages.userActionRequestedFailed,
      );
    }
  }

}
