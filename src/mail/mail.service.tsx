import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { VerificationEmail } from './templates/VerificationEmail';
import { PasswordResetEmail } from './templates/PasswordResetEmail';
import { EmailChangeConfirmation } from './templates/EmailChangeConfirmation';
import { PasswordChangeInfoEmail } from './templates/PasswordChangeInfoEmail';
import { PasswordChangeEmail } from './templates/PasswordChangeEmail';
import { AdminRequestChangeAccountEmail } from './templates/AdminRequestChangeAccountUser';
import { AdminRejectAccountEmail } from './templates/AdminRejectAccountUser';
import { AdminApproveAccountEmail } from './templates/AdminApproveAccountUser';
import { ReferrerApproveAccountEmail } from './templates/ReferrerApproveAccountUser';
import { ReferrerRejectAccountEmail } from './templates/ReferrerRejectAccountUser';
import { ReferrerRequestChangeAccountEmail } from './templates/ReferrerRequestChangeAccountUser';
import { UnpublishedPostNotification } from './templates/UnpublishedPostNotification';
import { KycRequestChangeEmail } from './templates/AdminRequestChangeKycEmail';
import KycApprovedEmail from './templates/AdminApproveKycMail';
import { KYCPendingNotificationEmail } from './templates/KYCPendingNotificationEmail';
import NotificationUpdateKycEmail from './templates/NotificationUpdateKycEmail';
import KycUpdateReminderEmail from './templates/NotificationChangingKycEmail';
import { ApiKeyOtpEmail } from './templates/ApiKeyOtpEmail';
@Injectable()
export class MailService {
  private resend: Resend;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private validateEmailConfig() {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    if (!process.env.FRONTEND_DOMAIN) {
      throw new Error('FRONTEND_DOMAIN environment variable is not set');
    }
  }

  private async sendEmailWithRetry<T>(
    emailFunction: () => Promise<T>,
    email: string,
    emailType: string,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await emailFunction();
        this.logger.log(
          `${emailType} email sent successfully to ${email} on attempt ${attempt}`,
        );
        return result;
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Failed to send ${emailType} email to ${email} (attempt ${attempt}/${maxRetries}): ${error.message}`,
        );

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = delayMs * Math.pow(2, attempt - 1);
          this.logger.log(
            `Retrying ${emailType} email send to ${email} in ${waitTime}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    this.logger.error(
      `Failed to send ${emailType} email to ${email} after ${maxRetries} attempts. Last error: ${lastError?.message}`,
      lastError?.stack,
    );
    throw lastError;
  }

  async sendVerificationEmail(email: string, name: string, token: string) {
    this.validateEmailConfig();
    const url = `${process.env.FRONTEND_DOMAIN}/verify-email?token=${token}`;
    const html = await render(<VerificationEmail name={name} url={url} />);

    return this.sendEmailWithRetry(
      () =>
        this.resend.emails.send({
          from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
          to: email,
          subject: 'Xác nhận tài khoản',
          html,
          headers: {
            'Content-Language': 'vi',
            'X-Language': 'Vietnamese',
          },
        }),
      email,
      'verification',
    );
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    this.validateEmailConfig();
    const url = `${process.env.FRONTEND_DOMAIN}/reset-password?token=${token}`;
    const html = await render(
      <PasswordResetEmail name={name} resetUrl={url} />,
    );

    return this.sendEmailWithRetry(
      () =>
        this.resend.emails.send({
          from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
          to: email,
          subject: 'Yêu cầu đặt lại mật khẩu',
          html,
          headers: {
            'Content-Language': 'vi',
            'X-Language': 'Vietnamese',
          },
        }),
      email,
      'password reset',
    );
  }

  async sendEmailChangeConfirmation(
    email: string,
    name: string,
    token: string,
  ) {
    const url = `${process.env.FRONTEND_DOMAIN}/confirm-email-change?token=${token}`;
    const html = await render(
      <EmailChangeConfirmation name={name} url={url} />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Xác nhận địa chỉ email mới',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendPasswordChangeOtpEmail(name: string, email: string, otp: string) {
    const html = await render(<PasswordChangeEmail name={name} otp={otp} />);

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Mã OTP xác thực thay đổi mật khẩu',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendWelcomeEmail(email: string, name: string) {
    const html = await render(<WelcomeEmail name={name} />);

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject:
        'Chào mừng bạn đến với Liên minh Cộng đồng Affiliate thực chiến!',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendPasswordChangeInfoEmail(
    email: string,
    name: string,
    changeTime: Date,
  ) {
    const html = await render(
      <PasswordChangeInfoEmail name={name} changeTime={changeTime} />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Mật khẩu của bạn đã được thay đổi',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendAdminRequestChangeAccountEmail(
    email: string,
    name: string,
    rejectionReason: string,
    changeTime: Date,
  ) {
    const html = await render(
      <AdminRequestChangeAccountEmail
        name={name}
        rejectionReason={rejectionReason}
        changeTime={changeTime}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Yêu cầu đổi thông tin tài khoản',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendAdminRejectAccountEmail(
    email: string,
    name: string,
    rejectionReason: string,
    changeTime: Date,
  ) {
    const html = await render(
      <AdminRejectAccountEmail
        name={name}
        rejectionReason={rejectionReason}
        changeTime={changeTime}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Tài khoản của bạn đã bị từ chối',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendAdminApproveAccountEmail(
    email: string,
    name: string,
    changeTime: Date,
  ) {
    const html = await render(
      <AdminApproveAccountEmail name={name} changeTime={changeTime} />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Tài khoản của bạn đã được phê duyệt',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendReferrerApproveAccountEmail(
    email: string,
    name: string,
    referrerName: string,
    changeTime: Date,
  ) {
    const html = await render(
      <ReferrerApproveAccountEmail
        name={name}
        referrerName={referrerName}
        changeTime={changeTime}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Tài khoản của bạn đã được phê duyệt',
      html,
    });
  }

  async sendReferrerRejectAccountEmail(
    email: string,
    name: string,
    referrerName: string,
    rejectionReason: string,
    changeTime: Date,
  ) {
    const html = await render(
      <ReferrerRejectAccountEmail
        name={name}
        referrerName={referrerName}
        rejectionReason={rejectionReason}
        changeTime={changeTime}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Tài khoản của bạn đã bị từ chối',
      html,
    });
  }

  async sendReferrerRequestChangeAccountEmail(
    email: string,
    name: string,
    referrerName: string,
    rejectionReason: string,
    changeTime: Date,
  ) {
    const html = await render(
      <ReferrerRequestChangeAccountEmail
        name={name}
        referrerName={referrerName}
        rejectionReason={rejectionReason}
        changeTime={changeTime}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Yêu cầu đổi thông tin tài khoản',
      html,
    });
  }

  async sendUnpublishedPostNotification(
    email: string,
    name: string,
    totalPosts: string,
  ) {
    const html = await render(
      <UnpublishedPostNotification name={name} totalPosts={totalPosts} />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: `Thông báo: ${totalPosts} bài viết chưa được xuất bản`,
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendUnpublishedPostNotificationBatch(
    adminUsers: Array<{
      id: string;
      email: string;
      fullName: string;
    }>,
    totalPosts: string,
    urlLink: string,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Send emails in parallel with better error handling
    const emailPromises = adminUsers.map(async (admin) => {
      try {
        const html = await render(
          <UnpublishedPostNotification
            name={admin.fullName || 'Admin'}
            totalPosts={totalPosts}
            urlLink={urlLink}
          />,
        );

        await this.resend.emails.send({
          from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
          to: admin.email,
          subject: `Thông báo: ${totalPosts} bài viết chưa được xuất bản`,
          html,
          headers: {
            'Content-Language': 'vi',
            'X-Language': 'Vietnamese',
          },
        });

        results.success++;
        return { success: true, email: admin.email };
      } catch (error) {
        results.failed++;
        const errorMessage = `Failed to send email to ${admin.email}: ${error.message}`;
        results.errors.push(errorMessage);
        return { success: false, email: admin.email, error: errorMessage };
      }
    });

    // Wait for all emails to complete
    await Promise.allSettled(emailPromises);

    return results;
  }

  async sendAdminRequestChangeKycEmail(
    email: string,
    name: string,
    message: string,
    reviewerName: string,
  ) {
    const html = await render(
      <KycRequestChangeEmail
        name={name}
        message={message}
        reviewerName={reviewerName}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Yêu cầu đổi thông tin KYC',
      html,
    });
  }

  async sendAdminApproveKycEmail(
    email: string,
    name: string,
    reviewerName: string,
  ) {
    const html = await render(
      <KycApprovedEmail name={name} reviewerName={reviewerName} />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Thông tin KYC của bạn đã được phê duyệt',
      html,
    });
  }

  async sendKYCPendingNotificationEmail(
    email: string,
    adminName: string,
    totalSubmitted: number,
    recentCount: number,
    olderCount: number,
    dashboardUrl: string,
  ) {
    const html = await render(
      <KYCPendingNotificationEmail
        adminName={adminName}
        totalSubmitted={totalSubmitted}
        recentCount={recentCount}
        olderCount={olderCount}
        dashboardUrl={dashboardUrl}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: `Thông báo: ${totalSubmitted} KYC đang chờ xử lý`,
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendNotificationUpdateKycEmail(
    email: string,
    name: string,
    reason: string,
    updateUrl: string,
  ) {
    const html = await render(
      <NotificationUpdateKycEmail
        name={name}
        reason={reason}
        updateUrl={updateUrl}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Yêu cầu cập nhật thông tin KYC',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendNotificationChangingKycEmail(
    email: string,
    name: string,
    message: string,
    reviewerName: string,
    updateUrl: string,
  ) {
    const html = await render(
      <KycUpdateReminderEmail
        name={name}
        message={message}
        reviewerName={reviewerName}
        updateUrl={updateUrl}
      />,
    );

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Thông báo: Thông tin KYC của bạn cần được sửa đổi',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }

  async sendApiKeyOtpEmail(name: string, email: string, otp: string) {
    const html = await render(<ApiKeyOtpEmail name={name} otp={otp} />);

    await this.resend.emails.send({
      from: 'Liên minh Cộng đồng Affiliate thực chiến <lienhe@acta.vn>',
      to: email,
      subject: 'Mã OTP xác thực lấy API Key',
      html,
      headers: {
        'Content-Language': 'vi',
        'X-Language': 'Vietnamese',
      },
    });
  }
}
