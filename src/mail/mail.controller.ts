import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MailService } from './mail.service';
import { SendPasswordResetDto } from './dto/send-password-request.dto';
import { SendEmailChangeDto } from './dto/send-email-change.dto';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('send-password-reset')
  @HttpCode(HttpStatus.OK)
  async sendPasswordResetEmail(@Body() dto: SendPasswordResetDto) {
    await this.mailService.sendPasswordResetEmail(
      dto.email,
      dto.fullName,
      dto.token,
    );
    return { message: 'Gửi email reset mật khẩu thành công' };
  }

  @Post('send-email-change')
  @HttpCode(HttpStatus.OK)
  async sendEmailChangeEmail(@Body() dto: SendEmailChangeDto) {
    await this.mailService.sendEmailChangeConfirmation(
      dto.email,
      dto.fullName,
      dto.url,
    );
    return { message: 'Gửi email xác nhận thay đổi email thành công' };
  }
}
