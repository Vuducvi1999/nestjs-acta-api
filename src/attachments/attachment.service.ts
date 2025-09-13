import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Attachment } from '@prisma/client';

@Injectable()
export class AttachmentService {
  constructor(private readonly prisma: PrismaService) {}

  async updateUserAvatar(
    userId: string,
    avatarUrl: string,
    originalFileName: string,
  ): Promise<Attachment> {
    return this.prisma.$transaction(async (prisma) => {
      // Get current user with avatar
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { avatar: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create new attachment
      const newAttachment = await prisma.attachment.create({
        data: {
          fileName: `avatar_${Date.now()}.jpg`,
          mimeType: 'image',
          fileUrl: avatarUrl,
          originalFileName,
        },
      });

      // If user has an existing avatar, mark it as an old avatar
      if (user.avatar) {
        await prisma.attachment.update({
          where: { id: user.avatar.id },
          data: {
            oldAvatarUserId: userId,
          },
        });
      }

      // Update user's avatarId to point to new attachment
      await prisma.user.update({
        where: { id: userId },
        data: { avatarId: newAttachment.id },
      });

      return newAttachment;
    });
  }

  async getUserOldAvatars(userId: string): Promise<Attachment[]> {
    try {
      const oldAvatars = await this.prisma.attachment.findMany({
        where: {
          oldAvatarUserId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return oldAvatars || [];
    } catch (error) {
      return [];
    }
  }

  async updateUserCover(
    userId: string,
    coverUrl: string,
    originalFileName: string,
  ): Promise<Attachment> {
    return this.prisma.$transaction(async (prisma) => {
      // Get current user with cover
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { cover: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create new attachment
      const newAttachment = await prisma.attachment.create({
        data: {
          fileName: `cover_${Date.now()}.jpg`,
          mimeType: 'image',
          fileUrl: coverUrl,
          originalFileName,
        },
      });

      // If user has an existing cover, mark it as an old cover
      if (user.cover) {
        await prisma.attachment.update({
          where: { id: user.cover.id },
          data: {
            oldCoverUserId: userId,
          },
        });
      }

      // Update user's coverId to point to new attachment
      await prisma.user.update({
        where: { id: userId },
        data: { coverId: newAttachment.id },
      });

      return newAttachment;
    });
  }

  async getUserOldCovers(userId: string): Promise<Attachment[]> {
    try {
      const oldCovers = await this.prisma.attachment.findMany({
        where: {
          oldCoverUserId: userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return oldCovers || [];
    } catch (error) {
      return [];
    }
  }
}
