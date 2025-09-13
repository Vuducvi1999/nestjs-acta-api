import { Module } from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  providers: [AttachmentService, PrismaService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
