import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityTargetType,
  ActivityType,
  Attachment,
  KycStatus,
  User,
  UserStatus,
  Role,
} from '@prisma/client';
import { Cache } from 'cache-manager';
import { SocketEmitterService } from './socket-emitter.service';
import { ActivityLogService } from '../../activity-logs/activity-log.service';
import { AttachmentService } from '../../attachments/attachment.service';
import { JwtPayload } from '../../auth/jwt-payload';
import { PrismaService } from '../../common/services/prisma.service';
import { messages } from '../../constants/messages';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserProfileResponseDto } from '../dto/user-profile-response.dto';
import { USER_CONFIG_KEYS } from '../models/user-config.constant';
import { defaultConfig } from '../users-config.service';
import { CreateKYCDto } from '../dto/create-kyc.dto';
import { AvatarPostService } from './avatar-post.service';
import { AvatarUpdateReason } from '../constants/avatar-post.constants';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);
  private readonly CACHE_TTL = 120 * 1000; // 2 minutes in milliseconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentService: AttachmentService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly activityLogService: ActivityLogService,
    private readonly avatarPostService: AvatarPostService,
    private readonly socketEmitterService: SocketEmitterService,
  ) {}

  async getUserProfile(
    user: JwtPayload,
    id: string,
  ): Promise<UserProfileResponseDto> {
    try {
      const cacheKey = `user-profile:${id}`;
      const cachedUserProfile =
        await this.cacheManager.get<UserProfileResponseDto>(cacheKey);
      if (cachedUserProfile) return cachedUserProfile;

      const targetUser = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          referenceId: true,
          avatar: {
            select: {
              fileUrl: true,
            },
          },
          cover: {
            select: {
              fileUrl: true,
            },
          },
          email: true,
          fullName: true,
          phoneNumber: true,
          dob: true,
          gender: true,
          country: true,
          bio: true,
          website: true,
          verificationDate: true,
          isActive: true,
          status: true,
          role: true,
          referrer: {
            select: {
              id: true,
              fullName: true,
              referenceId: true,
              avatar: {
                select: {
                  fileUrl: true,
                },
              },
            },
          },
          addresses: {
            select: {
              id: true,
              name: true,
              type: true,
              fullName: true,
              phone: true,
              street: true,
              ward: true,
              district: true,
              city: true,
              state: true,
              country: true,
              postalCode: true,
              placeId: true,
              latitude: true,
              longitude: true,
              formattedAddress: true,
              isDefault: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          },
          userConfig: {
            select: {
              config: true,
            },
          },
          _count: {
            select: {
              referrals: true,
              posts: {
                where: {
                  isPublished: true,
                  publishedAt: {
                    not: null,
                  },
                  deletedAt: null,
                },
              },
              followers: {
                where: {
                  deletedAt: null,
                },
              },
              following: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      let isInformationPrivate: boolean = false;
      if (!targetUser) {
        this.logger.warn(`User with ID "${id}" does not exist`);
        throw new NotFoundException('User does not exist');
      }

      const isOwnProfile = user.id === id;

      if (!isOwnProfile) {
        let userConfig = targetUser.userConfig?.config as
          | Record<string, any>
          | undefined;

        if (!userConfig) {
          const createdConfig = await this.prisma.userConfig.create({
            data: {
              userId: targetUser.id,
              config: defaultConfig,
            },
          });

          userConfig = createdConfig.config as Record<string, any>;
        }

        // Fetch requesting user's role from DB to ensure latest role
        const requestingUser = await this.prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        // ADMIN BYPASS: If the requesting user is admin, skip privacy checks
        if (requestingUser?.role === Role.admin) {
          const userProfile = UserProfileResponseDto.fromUserEntity(
            targetUser,
            false,
          );
          await this.cacheManager.set(cacheKey, userProfile, this.CACHE_TTL);
          this.logger.log(
            `User profile fetched successfully for admin: ${targetUser.fullName} - ${targetUser.referenceId}`,
          );
          return userProfile;
        }

        const profilePrivacy = userConfig?.[USER_CONFIG_KEYS.PROFILE_PRIVACY];
        const informationPublicity =
          userConfig?.[USER_CONFIG_KEYS.INFORMATION_PUBLICITY];

        if (profilePrivacy === 'private') {
          const isInHierarchy = await this.validateReferralHierarchy(
            targetUser.id,
            user.referenceId,
          );

          if (!isInHierarchy.isInHierarchy) {
            this.logger.warn(
              `User ${user.referenceId} attempted to access private profile of user ${targetUser.referenceId}`,
            );
            throw new NotFoundException('User profile is private');
          }
        }

        if (informationPublicity === 'private') {
          const isInHierarchy = await this.validateReferralHierarchy(
            targetUser.id,
            user.referenceId,
          );

          if (!isInHierarchy.isInHierarchy) {
            this.logger.warn(
              `User ${user.referenceId} attempted to access private information of user ${targetUser.referenceId}`,
            );
            isInformationPrivate = true;
          }
        }
      }

      const userProfile = UserProfileResponseDto.fromUserEntity(
        targetUser,
        isInformationPrivate,
      );

      await this.cacheManager.set(cacheKey, userProfile, this.CACHE_TTL);

      this.logger.log(
        `User profile fetched successfully for user: ${targetUser.fullName} - ${targetUser.referenceId}`,
      );
      return userProfile;
    } catch (error) {
      this.logger.error('Error fetching user profile:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch user profile');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    const { avatarId, coverId, ...rest } = updateUserDto;

    let avatarAttachment: Attachment | null = null;
    let coverAttachment: Attachment | null = null;

    if (avatarId) {
      avatarAttachment = await this.prisma.attachment.create({
        data: {
          fileName: `avatar_${id}_${Date.now()}.jpeg`,
          mimeType: 'image/jpeg',
          originalFileName: `avatar_${id}.jpeg`,
          fileUrl: avatarId,
        },
      });
    }

    if (coverId) {
      coverAttachment = await this.prisma.attachment.create({
        data: {
          fileName: `cover_${id}_${Date.now()}.jpeg`,
          mimeType: 'image/jpeg',
          originalFileName: `cover_${id}.jpeg`,
          fileUrl: coverId,
        },
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        avatar: avatarAttachment
          ? {
              connect: { id: avatarAttachment.id },
            }
          : undefined,
        cover: coverAttachment
          ? {
              connect: { id: coverAttachment.id },
            }
          : undefined,
      },
      include: {
        avatar: true,
        cover: true,
      },
    });

    await this.activityLogService.createActivityLog(
      id,
      ActivityTargetType.USER,
      ActivityType.USER_UPDATED,
      updatedUser,
      `User ${updatedUser.fullName} updated their profile`,
      {
        old: user,
        new: updatedUser,
      },
    );

    return updatedUser;
  }

  async updateUserAvatar(
    userId: string,
    avatarUrl: string,
    originalFileName?: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { avatar: true },
      });
      if (!user) throw new NotFoundException(messages.userNotFound);

      // Store old avatar URL for comparison
      const oldAvatarUrl = user.avatar?.fileUrl || null;

      const fileName = originalFileName || `avatar_${userId}_${Date.now()}.jpg`;
      const updatedAttachment = await this.attachmentService.updateUserAvatar(
        userId,
        avatarUrl,
        fileName,
      );

      // Invalidate user profile cache to ensure fresh data
      const cacheKey = `user-profile:${userId}`;
      await this.cacheManager.del(cacheKey);

      await this.activityLogService.createActivityLog(
        userId,
        ActivityTargetType.USER,
        ActivityType.USER_UPDATED,
        user,
        `User ${user.fullName} updated their avatar`,
      );

      try {
        const avatarPostResult = await this.avatarPostService.createAvatarPost({
          context: {
            userId,
            oldAvatarUrl,
            newAvatarUrl: avatarUrl,
            originalFileName,
            updateReason: AvatarUpdateReason.USER_INITIATED,
            timestamp: new Date(),
          },
        });

        if (avatarPostResult.success) {
          this.logger.log(
            `Avatar post created successfully for user ${userId}: ${avatarPostResult.postId}`,
          );
        } else if (avatarPostResult.skipped) {
          this.logger.log(
            `Avatar post skipped for user ${userId}: ${avatarPostResult.skipReason}`,
          );
        } else {
          this.logger.warn(
            `Failed to create avatar post for user ${userId}: ${avatarPostResult.error}`,
          );
        }
      } catch (error) {
        // Don't fail the avatar update if post creation fails
        this.logger.error(
          `Error creating avatar post for user ${userId}:`,
          error,
        );
      }

      return updatedAttachment;
    } catch (error) {
      this.logger.error(
        `Error updating user avatar for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  async updateUserCover(
    userId: string,
    coverUrl: string,
    originalFileName?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException(messages.userNotFound);

    const fileName = originalFileName || `cover_${userId}_${Date.now()}.jpg`;
    const updatedAttachment = await this.attachmentService.updateUserCover(
      userId,
      coverUrl,
      fileName,
    );

    // Invalidate user profile cache to ensure fresh data
    const cacheKey = `user-profile:${userId}`;
    await this.cacheManager.del(cacheKey);

    await this.activityLogService.createActivityLog(
      userId,
      ActivityTargetType.USER,
      ActivityType.USER_UPDATED,
      user,
      `User ${user.fullName} updated their cover`,
    );

    return updatedAttachment;
  }

  async getCurrentUserAvatar(
    userId: string,
  ): Promise<{ avatarUrl: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatar: {
          select: {
            fileUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      avatarUrl: user.avatar?.fileUrl || null,
    };
  }

  async getCurrentUserCover(
    userId: string,
  ): Promise<{ coverUrl: string | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        cover: {
          select: {
            fileUrl: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      coverUrl: user.cover?.fileUrl || null,
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByReferenceId(referenceId: string) {
    referenceId = referenceId.trim().toLowerCase();
    const splitReferenceIdAndTimestamp = referenceId.split('-');
    const convertedReferenceId =
      splitReferenceIdAndTimestamp[0] + '-' + splitReferenceIdAndTimestamp[1];
    const timestamp = parseInt(splitReferenceIdAndTimestamp[2]);
    const user = await this.prisma.user.findUnique({
      where: {
        referenceId: convertedReferenceId,
        createdAt: new Date(timestamp),
      },
      include: {
        avatar: true,
      },
    });

    if (!user) {
      throw new NotFoundException(messages.userNotFoundOrNotVerified);
    }

    if (
      user.status === UserStatus.pending ||
      user.status === UserStatus.pending_admin
    ) {
      throw new NotFoundException(messages.userNotFoundOrNotVerified);
    }

    return user;
  }

  async getNewUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        verificationDate: {
          not: null,
        },
      },
      select: {
        id: true,
        fullName: true,
        avatar: {
          select: {
            fileUrl: true,
          },
        },
        referenceId: true,
        verificationDate: true,
      },
      orderBy: {
        verificationDate: 'desc',
      },
      take: 5,
    });
    return users;
  }

  private async validateReferralHierarchy(
    targetUserId: string,
    currentUserReferenceId: string,
  ): Promise<{ isInHierarchy: boolean; depth: number }> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { referrerId: true, referenceId: true, fullName: true },
    });

    if (!targetUser) {
      this.logger.warn(`Target user not found: ${targetUserId}`);
      return { isInHierarchy: false, depth: 0 };
    }

    if (!targetUser.referrerId) {
      return { isInHierarchy: false, depth: 0 };
    }

    let currentReferrerId: string | null = targetUser.referrerId;
    let depth = 0;
    const maxDepth = 2;

    while (currentReferrerId && depth < maxDepth) {
      depth++;

      if (currentReferrerId === currentUserReferenceId) {
        return { isInHierarchy: true, depth };
      }

      const referrer = await this.prisma.user.findUnique({
        where: { referenceId: currentReferrerId },
        select: { referrerId: true, fullName: true },
      });

      if (!referrer) {
        break;
      }

      currentReferrerId = referrer.referrerId;
    }

    if (depth >= maxDepth) {
      this.logger.warn(
        `Max depth reached (${maxDepth}) during hierarchy traversal - possible infinite loop`,
      );
    }

    return { isInHierarchy: false, depth: 0 };
  }

  async createKYC(userId: string, body: CreateKYCDto) {
    this.logger.log(
      `🚀 [KYC Service] Starting KYC creation for user ${userId}`,
    );
    this.logger.log(`📝 [KYC Service] KYC data:`, body);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.error(`❌ [KYC Service] User not found: ${userId}`);
      throw new NotFoundException(messages.userNotFound);
    }

    this.logger.log(
      `✅ [KYC Service] User found: ${user.fullName} (${user.email})`,
    );

    // Check if user already has KYC
    const existingKYC = await this.prisma.userKYC.findUnique({
      where: { userId },
    });

    if (existingKYC) {
      this.logger.error(
        `❌ [KYC Service] User ${userId} already has KYC record: ${existingKYC.id}`,
      );
      throw new Error('User already has KYC record');
    }

    this.logger.log(
      `✅ [KYC Service] No existing KYC found, creating new KYC record...`,
    );

    const kyc = await this.prisma.userKYC.create({
      data: {
        userId,
        fullName: body.fullName,
        dateOfBirth: new Date(body.dateOfBirth),
        nationality: body.nationality,
        address: body.address,
        kycNumber: body.kycNumber,
        kycFileUrl: body.kycFileUrl,
        status: KycStatus.submitted,
      },
    });

    this.logger.log(`✅ [KYC Service] KYC record created with ID: ${kyc.id}`);

    // Update user status to kyc_submitted
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.kyc_submitted },
    });

    this.logger.log(`✅ [KYC Service] User status updated to kyc_submitted`);

    await this.activityLogService.createActivityLog(
      userId,
      ActivityTargetType.USER,
      ActivityType.USER_UPDATED,
      user,
      `User ${user.fullName} submitted KYC`,
      {
        kycId: kyc.id,
        kycNumber: kyc.kycNumber,
        status: kyc.status,
      },
    );

    this.logger.log(`✅ [KYC Service] Activity log created`);

    const result = {
      success: true,
      message: 'KYC submitted successfully',
      kycId: kyc.id,
      status: kyc.status,
    };

    this.logger.log(
      `✅ [KYC Service] KYC creation completed successfully:`,
      result,
    );
    return result;
  }

  async getKYC(userId: string) {
    const kyc = await this.prisma.userKYC.findUnique({
      where: { userId },
      select: {
        fullName: true,
        dateOfBirth: true,
        nationality: true,
        address: true,
        kycNumber: true,
        kycFileUrl: true,
        status: true,
        message: true,
      },
    });

    if (!kyc) {
      return null;
    }

    return kyc;
  }
}
