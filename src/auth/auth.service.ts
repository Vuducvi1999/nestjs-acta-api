import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ActivityType,
  NotificationAction,
  Prisma,
  RelatedModel,
  Role,
  UserStatus,
  User,
  Gender,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { TokenExpiredError } from 'jsonwebtoken';
import { nanoid } from 'nanoid';

import { ActivityLogService } from '../activity-logs/activity-log.service';
import { AllConfigType } from '../common/configs/types/index.type';
import { PrismaService } from '../common/services/prisma.service';
import { messages, loginErrorMessages } from '../constants/messages';
import { MailService } from '../mail/mail.service';
import { UserProfileResponseDto } from '../users/dto/user-profile-response.dto';
import { UserConfigService } from '../users/users-config.service';
import { AuthUser } from './auth-user';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { Tokens } from './interfaces/tokens.interface';
import { JwtPayload } from './jwt-payload';
import { ChangeEmailRequest, ChangePasswordRequest } from './models';
import { NotificationService } from '../notifications/notification.service';
import { AuthGateway } from './auth.gateway';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly firstPositionProfile = 11000;
  private readonly phoneNumberRegex = /^[0-9]{10,15}$/;
  private readonly emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  constructor(
    private readonly userConfigService: UserConfigService,
    private readonly activityLogService: ActivityLogService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly notificationService: NotificationService,
    private readonly authGateway: AuthGateway,
  ) {
    this.jwtSecret = this.configService.getOrThrow('app.jwtSecretKey', {
      infer: true,
    });
    this.jwtRefreshSecret = this.configService.getOrThrow(
      'app.jwtRefreshSecretKey',
      {
        infer: true,
      },
    );
  }

  private userToJwtPayload(user: any): JwtPayload {
    if (!user.referenceId) {
      throw new UnauthorizedException(messages.userNotVerified);
    }
    return {
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      referenceId: user.referenceId,
    };
  }

  private generateTokens(
    userId: string,
    email: string,
    phoneNumber: string,
    referenceId: string | null,
  ): Tokens {
    if (!referenceId) {
      throw new UnauthorizedException(messages.userNotVerified);
    }
    const payload = this.userToJwtPayload({
      id: userId,
      email,
      phoneNumber,
      referenceId,
    });

    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '1000h', // 1000 hours expiration
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.jwtRefreshSecret,
      expiresIn: '2000h', // 2000 hours expiration (longer than access token)
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private formatFullName(fullName: string): string {
    return fullName
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async checkEmailExists(email: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { email: true },
    });

    if (existingUser) {
      throw new ConflictException(messages.emailAlreadyExists);
    }
  }

  private async checkPhoneNumberExists(phoneNumber: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { phoneNumber, verificationDate: { not: null } },
      select: { phoneNumber: true },
    });
    if (user) {
      throw new ConflictException(messages.phoneNumberAlreadyExists);
    }
  }

  private async sendVerificationEmailWithRetry(
    email: string,
    name: string,
    token: string,
    userId: string,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.mailService.sendVerificationEmail(email, name, token);
        this.logger.log(
          `Verification email sent successfully to ${email} on attempt ${attempt}`,
        );
        return; // Success, exit the retry loop
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `Failed to send verification email to ${email} (attempt ${attempt}/${maxRetries}): ${error.message}`,
        );

        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = delayMs * Math.pow(2, attempt - 1);
          this.logger.log(
            `Retrying email send to ${email} in ${waitTime}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    this.logger.error(
      `Failed to send verification email to user ${userId} (${email}) after ${maxRetries} attempts. Last error: ${lastError?.message}`,
      lastError?.stack,
    );

    // Don't throw error - registration should still succeed even if email fails
    // The user can request a new verification email later
  }

  private async safeActivityLog(
    userId: string,
    type: ActivityType,
    payload: any,
    message: string,
    meta?: Record<string, any>,
  ) {
    try {
      await this.activityLogService.createActivityLog(
        userId,
        'USER',
        type,
        payload,
        message,
        meta,
      );
    } catch (e) {
      this.logger.warn(`ActivityLog skipped: ${message} -> ${e?.message}`);
    }
  }

  async register(registerDto: RegisterDto): Promise<string> {
    await this.checkEmailExists(registerDto.email);
    await this.checkPhoneNumberExists(registerDto.phoneNumber);
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const emailVerificationToken = nanoid(21);
    const lastestUser = await this.prisma.user.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        referenceId: true,
      },
    });
    const profileCount = lastestUser ? Number(lastestUser.referenceId.split('-')[1]) : this.firstPositionProfile;
    const formattedCount = (
      profileCount +
      1
    ).toString();
    const referenceId = `VN-${formattedCount}`.toLowerCase();

    try {
      let referrerId: string | null = null;
      let referrer: User | null = null;
      if (registerDto.referrerId) {
        const referrerIdPattern = /^[a-z]{2}-\d{4,}-\d{10,}$/i;
        if (!referrerIdPattern.test(registerDto.referrerId)) {
          throw new BadRequestException('Invalid referrerId format.');
        }

        const rawReferrerId = registerDto.referrerId
          .split('-')
          .slice(0, 2)
          .join('-')
          .toLowerCase();

        const existedReferrer = await this.prisma.user.findUnique({
          where: {
            referenceId: rawReferrerId,
          },
        });

        if (!existedReferrer) {
          throw new BadRequestException(messages.referrerNotFound);
        }

        if (
          existedReferrer.status === UserStatus.pending ||
          existedReferrer.status === UserStatus.pending_admin
        ) {
          throw new BadRequestException(messages.referrerNotFound);
        }

        referrer = existedReferrer;
        referrerId = referrer.referenceId;
      }

      const formattedPhoneNumber = registerDto.phoneNumber.startsWith('0')
        ? registerDto.phoneNumber
        : '0' + registerDto.phoneNumber;

      const user = await this.prisma.$transaction(async (prisma) => {
        const attachment = await prisma.attachment.create({
          data: {
            fileName: `avatar_${Date.now()}.jpg`,
            mimeType: 'image',
            originalFileName: `avatar.jpg`,
            fileUrl:
              'https://2evl34cah0.ufs.sh/f/a6wlsorGVg4vCxySMMK6XOR7LjVSTtyk1oFdHKD9E5xfCw3b',
          },
        });

        const user = await prisma.user.create({
          data: {
            email: registerDto.email.toLowerCase(),
            passwordHash: hashedPassword,
            fullName: this.formatFullName(registerDto.fullName),
            phoneNumber: formattedPhoneNumber,
            country: 'not_known',
            referenceId,
            referrerId,
            gender: Gender.not_known,
            dob: new Date(1900, 1, 1),
            status: UserStatus.pending,
            role: Role.user,
            avatarId: attachment.id,
            emailVerification: {
              create: {
                token: emailVerificationToken,
                validUntil: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
              },
            },
          },
        });

        if (referrerId) {
          const ancestorClosures = await prisma.userReferralClosure.findMany({
            where: { descendantId: referrerId },
            select: { ancestorId: true, depth: true },
          });

          const closureInserts = [
            // Self reference
            {
              ancestorId: referenceId,
              descendantId: referenceId,
              depth: 0,
            },
            // Direct referrer
            {
              ancestorId: referrerId,
              descendantId: referenceId,
              depth: 1,
            },
            // Ancestors of the referrer
            ...ancestorClosures.map((closure) => ({
              ancestorId: closure.ancestorId,
              descendantId: referenceId,
              depth: closure.depth + 1,
            })),
          ];

          await prisma.userReferralClosure.createMany({
            data: closureInserts,
            skipDuplicates: true,
          });
        } else {
          // If no referrer, still add self-reference
          await prisma.userReferralClosure.create({
            data: {
              ancestorId: referenceId,
              descendantId: referenceId,
              depth: 0,
            },
          });
        }

        return user;
      });

      // Log step: user created (before sending email)
      await this.safeActivityLog(
        user.id,
        ActivityType.USER_REGISTERED,
        this.userToJwtPayload(user),
        `Register step: user created`,
        { step: 'user_created' },
      );

      if (referrerId && referrer) {
        try {
          // Get all referrers (direct and indirect) in one query
          const referrers = await this.prisma.userReferralClosure.findMany({
            where: {
              descendantId: user.referenceId,
              depth: {
                in: [1, 2], // 1 = direct, 2 = indirect
              },
            },
            select: {
              depth: true,
              ancestorId: true,
            },
            orderBy: {
              depth: 'asc',
            },
          });

          // Process each referrer level
          for (const referrer of referrers) {
            const referrerUser = await this.prisma.user.findUnique({
              where: {
                referenceId: referrer.ancestorId,
              },
              select: {
                id: true,
              },
            });

            if (referrerUser) {
              if (referrer.depth === 1) {
                // Direct referrer
                await this.notificationService.createNotification({
                  userId: referrerUser.id,
                  relatedModel: RelatedModel.user,
                  relatedModelId: user.id,
                  action: NotificationAction.direct_referral_registered,
                  message: `Bạn đã có người đăng ký mới: ${user.fullName}`,
                });

                // Emit socket event for direct referral notification
                this.authGateway.emitNewDirectReferral(referrerUser.id);
              } else if (referrer.depth === 2) {
                // Indirect referrer
                await this.notificationService.createNotification({
                  userId: referrerUser.id,
                  relatedModel: RelatedModel.user,
                  relatedModelId: user.id,
                  action: NotificationAction.indirect_referral_registered,
                  message: `Bạn đã có người đăng ký gián tiếp mới: ${user.fullName}`,
                });

                // Emit socket event for indirect referral notification
                this.authGateway.emitNewIndirectReferral(referrerUser.id);
              }
            }
          }
        } catch (e) {
          await this.safeActivityLog(
            user.id,
            ActivityType.USER_REGISTERED,
            this.userToJwtPayload(user),
            'Register step: notify_referrers_failed',
            { step: 'notify_referrers_failed', error: e?.message },
          );
          throw e;
        }
      }

      // Try to send verification email with retry mechanism
      await this.sendVerificationEmailWithRetry(
        user.email,
        user.fullName,
        emailVerificationToken,
        user.id,
      );

      await this.safeActivityLog(
        user.id,
        ActivityType.USER_REGISTERED,
        this.userToJwtPayload(user),
        `Register step: verification email sent`,
        { step: 'verification_email_sent' },
      );

      return messages.registerSuccess;
    } catch (error) {
      // Best-effort: if user has been created before error, log the failure with found userId
      try {
        const created = await this.prisma.user.findUnique({
          where: { email: registerDto.email.toLowerCase() },
          select: {
            id: true,
            referenceId: true,
            email: true,
            phoneNumber: true,
          },
        });
        if (created?.id) {
          await this.safeActivityLog(
            created.id,
            ActivityType.USER_REGISTERED,
            {
              id: created.id,
              email: created.email,
              referenceId: created.referenceId,
              phoneNumber: created.phoneNumber,
            },
            'Register failed',
            { step: 'register_catch', error: error?.message },
          );
        }
      } catch {}
      if (error.code === 'P2002') {
        throw new InternalServerErrorException(messages.systemError);
      }
      throw error;
    }
  }

  async verifyEmail(token: string) {
    const updatedAt = new Date();

    try {
      const {
        result,
        currentUser,
        expiredMeta,
      }: {
        result: string;
        currentUser: any;
        expiredMeta?: {
          oldToken: string;
          newToken: string;
          oldValidUntil: Date;
        };
      } = await this.prisma.$transaction(async (prisma) => {
        let currentUser: any = null;

        const verification = await prisma.emailVerification.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                referenceId: true,
                updatedAt: true,
              },
            },
          },
        });

        if (!verification) {
          return {
            result: messages.invalidVerificationToken,
            currentUser: null,
          };
        }

        if (verification.validUntil < new Date()) {
          currentUser = verification.user;
          await prisma.emailVerification.delete({ where: { token } });
          const newToken = nanoid(21);
          await prisma.emailVerification.create({
            data: {
              userId: verification.userId,
              token: newToken,
              validUntil: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
            },
          });
          return {
            result: messages.expiredVerficationTokenAndResend,
            currentUser,
            expiredMeta: {
              oldToken: token,
              newToken,
              oldValidUntil: verification.validUntil,
            },
          };
        }

        if (!verification.user) {
          return {
            result: messages.userNotFound,
            currentUser: null,
          };
        }

        const existedUser = await prisma.user.findFirst({
          where: {
            phoneNumber: verification.user.phoneNumber,
            verificationDate: { not: null },
          },
        });

        if (existedUser) {
          await prisma.user.update({
            where: { id: verification.userId },
            data: { status: UserStatus.inactive },
          });
          currentUser = existedUser;
          await prisma.emailVerification.delete({ where: { token } });
          return {
            result: messages.userWithSamePhoneNumberAlreadyExists,
            currentUser,
          };
        }

        currentUser = verification.user;

        await prisma.emailVerification.delete({ where: { token } });

        await prisma.user.update({
          where: { id: currentUser.id },
          data: {
            verificationDate: updatedAt,
            updatedAt,
            status: UserStatus.pending_admin,
          },
        });

        // Get referrer information to send notification
        const userWithReferrer = await prisma.user.findUnique({
          where: { id: currentUser.id },
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            referenceId: true,
            referrerId: true,
          },
        });

        return {
          result: messages.emailVerifiedSuccessfully,
          currentUser: userWithReferrer,
        };
      });

      if (currentUser && result === messages.emailVerifiedSuccessfully) {
        await this.mailService.sendWelcomeEmail(
          currentUser.email,
          currentUser.fullName,
        );

        await this.safeActivityLog(
          currentUser.id,
          ActivityType.USER_EMAIL_VERIFIED,
          this.userToJwtPayload({
            ...currentUser,
            verificationDate: updatedAt,
          }),
          'VerifyEmail step: welcome_email_sent',
          { step: 'welcome_email_sent' },
        );
        return { success: true };
      } else if (
        currentUser &&
        result === messages.expiredVerficationTokenAndResend
      ) {
        // Log as soon as we detect expiration so admins can trace even if resend fails
        await this.safeActivityLog(
          currentUser.id,
          ActivityType.USER_EMAIL_VERIFIED,
          this.userToJwtPayload({ ...currentUser }),
          'VerifyEmail step: token_expired_detected',
          {
            step: 'expired_token_detected',
            oldToken: expiredMeta?.oldToken,
            newToken: expiredMeta?.newToken,
            oldValidUntil: expiredMeta?.oldValidUntil,
          },
        );
        await this.mailService.sendVerificationEmail(
          currentUser.email,
          currentUser.fullName,
          expiredMeta?.newToken || token,
        );
        await this.safeActivityLog(
          currentUser.id,
          ActivityType.USER_EMAIL_VERIFIED,
          this.userToJwtPayload({ ...currentUser }),
          'VerifyEmail step: token_expired_resend',
          {
            step: 'expired_token_resend',
            oldToken: expiredMeta?.oldToken,
            newToken: expiredMeta?.newToken,
            oldValidUntil: expiredMeta?.oldValidUntil,
          },
        );
        throw new UnauthorizedException(
          messages.expiredVerficationTokenAndResend,
        );
      } else if (result === messages.invalidVerificationToken) {
        throw new UnauthorizedException(messages.invalidVerificationToken);
      } else if (result === messages.userNotFound) {
        throw new NotFoundException(messages.userNotFound);
      } else if (
        currentUser &&
        result === messages.userWithSamePhoneNumberAlreadyExists
      ) {
        await this.mailService.sendAdminRejectAccountEmail(
          currentUser.email,
          currentUser.fullName,
          messages.userWithSamePhoneNumberAlreadyExists,
          new Date(),
        );
        await this.safeActivityLog(
          currentUser.id,
          ActivityType.USER_EMAIL_VERIFIED,
          this.userToJwtPayload(currentUser),
          'VerifyEmail step: duplicate_phone_detected',
          { step: 'duplicate_phone' },
        );
        throw new ConflictException(
          messages.userWithSamePhoneNumberAlreadyExists,
        );
      }
    } catch (error) {
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    try {
      // Validate input
      if (!loginDto.username || !loginDto.password) {
        return LoginResponseDto.error(
          loginErrorMessages[messages.usernameAndPasswordRequired],
          messages.usernameAndPasswordRequired,
        );
      }

      const username = loginDto.username.toLowerCase();
      let whereClause: Prisma.UserWhereInput;

      if (this.phoneNumberRegex.test(username)) {
        whereClause = { phoneNumber: username };
      } else if (this.emailRegex.test(username)) {
        whereClause = { email: username };
      } else {
        whereClause = { referenceId: username };
      }

      const user = await this.prisma.user.findFirst({
        where: whereClause,
        select: {
          id: true,
          referenceId: true,
          passwordHash: true,
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
          // Add referrer information
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
          // Add addresses information
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

      // If user not found, return error
      if (!user) {
        return LoginResponseDto.error(
          loginErrorMessages[messages.invalidCredentials],
          messages.invalidCredentials,
        );
      }

      const isPasswordValid = await bcrypt.compare(
        loginDto.password,
        user.passwordHash,
      );

      // If password is invalid, return error
      if (!isPasswordValid) {
        return LoginResponseDto.error(
          loginErrorMessages[messages.invalidCredentials],
          messages.invalidCredentials,
        );
      }

      // If user is inactive, return error
      if (user.status === UserStatus.inactive) {
        return LoginResponseDto.error(
          loginErrorMessages[messages.userNotActive],
          messages.userNotActive,
        );
      }

      // If user is not referrer and not admin, return error
      if (!user.referrer && user.role !== Role.admin) {
        return LoginResponseDto.error(
          loginErrorMessages[messages.userNotReferrer],
          messages.userNotReferrer,
        );
      }

      // If user is not verified, send verification email again
      if (!user.verificationDate) {
        const token = await this.prisma.$transaction(async (prisma) => {
          await prisma.emailVerification.deleteMany({
            where: { userId: user.id },
          });
          const token = nanoid(21);
          await prisma.emailVerification.create({
            data: {
              userId: user.id,
              token,
              validUntil: new Date(Date.now() + 1000 * 60 * 10), // 10 minutes
            },
          });
          return token;
        });
        await this.mailService.sendVerificationEmail(
          user.email,
          user.fullName,
          token,
        );
        return LoginResponseDto.error(
          loginErrorMessages[messages.userNotVerifiedEmailSentAgain],
          messages.userNotVerifiedEmailSentAgain,
        );
      }

      // If user does not have default config then initial default config
      let userConfig = await this.prisma.userConfig.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          config: true,
        },
      });

      if (!userConfig) {
        await this.userConfigService.initialDefaultUserConfig(
          this.userToJwtPayload(user),
        );

        userConfig = await this.prisma.userConfig.findUnique({
          where: {
            userId: user.id,
          },
        });
      }

      const tokens = this.generateTokens(
        user.id,
        user.email,
        user.phoneNumber,
        user.referenceId,
      );

      await this.activityLogService.createActivityLog(
        user.id,
        'USER',
        ActivityType.USER_LOGGED_IN,
        this.userToJwtPayload(user),
        `User ${user.fullName} logged in`,
        {
          loggedInUser: {
            id: user.id,
            referenceId: user.referenceId,
            email: user.email,
            phoneNumber: user.phoneNumber,
            country: user.country,
            gender: user.gender,
          },
        },
      );

      // Success case - return LoginResponseDto with tokens and user data
      return LoginResponseDto.success(
        tokens.accessToken,
        tokens.refreshToken,
        UserProfileResponseDto.fromUserEntity({
          ...user,
          userConfig: {
            config: userConfig?.config as Record<string, any>,
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        `Login failed for username: ${loginDto.username}`,
        error?.stack,
      );

      // For any unexpected errors, return a generic error response
      return LoginResponseDto.error(
        loginErrorMessages.systemError,
        'SYSTEM_ERROR',
      );
    }
  }

  async requestPasswordReset(email: string) {
    try {
      return await this.prisma.$transaction(async (prisma) => {
        const lower = email.toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email: lower, verificationDate: { not: null } },
        });

        if (!user) {
          throw new NotFoundException(messages.userNotFound);
        }

        const existingReset = await prisma.passwordReset.findUnique({
          where: { userId: user.id },
        });

        const now = new Date();

        if (existingReset && existingReset.validUntil > now) {
          // Existing reset is still valid
          return messages.passwordResetEmailAlreadySent;
        }

        // Delete any old reset entries (expired or otherwise)
        await prisma.passwordReset.deleteMany({
          where: { userId: user.id },
        });

        const token = nanoid(21);
        const validForMs = 5 * 60 * 1000; // 5 minutes
        const validUntil = new Date(now.getTime() + validForMs);

        await prisma.passwordReset.create({
          data: {
            token,
            userId: user.id,
            validUntil,
          },
        });

        await this.activityLogService.createActivityLog(
          user.id,
          'USER',
          ActivityType.USER_PASSWORD_RESET,
          this.userToJwtPayload(user),
          `User ${user.fullName} requested password reset`,
          {
            requestedUser: {
              id: user.id,
              referenceId: user.referenceId,
            },
          },
        );

        await this.mailService.sendPasswordResetEmail(
          user.email,
          user.fullName,
          token,
        );

        return messages.passwordResetEmailSent;
      });
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      await this.prisma.$transaction(async (prisma) => {
        const updatedAt = new Date();
        const reset = await prisma.passwordReset.findUnique({
          where: { token },
          include: { user: true },
        });
        if (!reset || reset.validUntil < new Date()) {
          throw new NotFoundException(messages.invalidResetToken);
        }

        await prisma.passwordReset.delete({
          where: { token },
        });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
          where: { id: reset.userId },
          data: { passwordHash: hashedPassword, updatedAt },
        });

        await this.mailService.sendPasswordChangeInfoEmail(
          reset.user.email,
          reset.user.fullName,
          updatedAt,
        );
        await this.activityLogService.createActivityLog(
          reset.user.id,
          'USER',
          ActivityType.USER_PASSWORD_CHANGED,
          this.userToJwtPayload(reset.user),
          `User ${reset.user.fullName} changed password`,
          {
            changedUser: {
              id: reset.user.id,
              referenceId: reset.user.referenceId,
              email: reset.user.email,
              phoneNumber: reset.user.phoneNumber,
              country: reset.user.country,
              gender: reset.user.gender,
              updatedAt,
            },
          },
        );
        return messages.passwordResetSuccess;
      });
    } catch (error) {
      throw error;
    }
  }

  async resendVerificationEmail(email: string) {
    const lower = email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: lower, verificationDate: null },
    });

    if (!user) {
      throw new NotFoundException(messages.userNotFoundOrNotVerified);
    }

    const token = nanoid(21);

    await this.prisma.$transaction([
      this.prisma.emailVerification.deleteMany({
        where: { userId: user.id },
      }),
      this.prisma.emailVerification.create({
        data: {
          token,
          userId: user.id,
        },
      }),
    ]);

    // Try to send verification email with retry mechanism
    await this.sendVerificationEmailWithRetry(
      user.email,
      user.fullName,
      token,
      user.id,
    );
  }

  async requestEmailChange(userId: string, newEmail: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(messages.userNotFound);
    }

    const lower = newEmail.toLowerCase();
    const emailExists = await this.prisma.user.findUnique({
      where: { email: lower },
    });

    if (emailExists) {
      throw new ConflictException(messages.emailAlreadyExists);
    }

    const token = nanoid(21);

    await this.prisma.$transaction([
      this.prisma.emailChange.deleteMany({
        where: { userId },
      }),
      this.prisma.emailChange.create({
        data: {
          token,
          userId,
          newEmail: lower,
        },
      }),
    ]);

    await this.mailService.sendEmailChangeConfirmation(
      lower,
      user.fullName,
      token,
    );
  }

  async confirmEmailChange(token: string) {
    const emailChange = await this.prisma.emailChange.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!emailChange || emailChange.validUntil < new Date()) {
      throw new NotFoundException(messages.invalidResetToken);
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: emailChange.userId },
        data: { email: emailChange.newEmail.toLowerCase() },
      }),
      this.prisma.emailChange.delete({
        where: { token },
      }),
    ]);
  }

  async sendChangeEmailMail(
    changeEmailRequest: ChangeEmailRequest,
    userId: string,
    name: string,
    oldEmail: string,
  ): Promise<void> {
    const emailAvailable = await this.isEmailAvailable(
      changeEmailRequest.newEmail,
    );
    if (!emailAvailable) {
      Logger.log(
        `User with id ${userId} tried to change its email to already used ${changeEmailRequest.newEmail}`,
      );
      throw new ConflictException();
    }

    const deletePrevEmailChangeIfExist = this.prisma.emailChange.deleteMany({
      where: { userId },
    });

    const token = nanoid();

    const createEmailChange = this.prisma.emailChange.create({
      data: {
        userId,
        token,
        newEmail: changeEmailRequest.newEmail,
      },
      select: null,
    });

    await this.prisma.$transaction([
      deletePrevEmailChangeIfExist,
      createEmailChange,
    ]);

    await this.mailService.sendEmailChangeConfirmation(
      changeEmailRequest.newEmail,
      name,
      token,
    );
  }

  async changeEmail(token: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (prisma) => {
        const emailChange = await prisma.emailChange.findUnique({
          where: { token },
        });
        if (emailChange !== null && emailChange.validUntil > new Date()) {
          await this.prisma.user.update({
            where: { id: emailChange.userId },
            data: {
              email: emailChange.newEmail.toLowerCase(),
            },
            select: null,
          });
        } else {
          Logger.log(`Invalid email change token ${token} is rejected.`);
          throw new NotFoundException();
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async sendResetPasswordMail(email: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        });
        if (user === null) {
          throw new NotFoundException();
        }
        await prisma.passwordReset.deleteMany({
          where: { userId: user.id },
        });

        const token = nanoid(21);
        await prisma.passwordReset.create({
          data: {
            userId: user.id,
            validUntil: new Date(Date.now() + 1000 * 60 * 5),
            token,
          },
        });
        await this.mailService.sendPasswordResetEmail(
          user.fullName,
          user.email,
          token,
        );
      });
    } catch (error) {
      throw error;
    }
  }

  async requestPasswordChangeOtp(
    userId: string,
    currentPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(messages.userNotFound);

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException(messages.invalidCurrentPassword);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const validUntil = new Date(Date.now() + 2 * 60 * 1000); // valid 2 minutes

    // Always delete old OTP regardless of validity
    await this.prisma.$transaction([
      this.prisma.passwordChangeOtp.deleteMany({ where: { userId } }),
      this.prisma.passwordChangeOtp.create({
        data: {
          userId,
          token: otp,
          validUntil,
        },
      }),
    ]);

    // Log
    await this.activityLogService.createActivityLog(
      userId,
      'USER',
      ActivityType.USER_PASSWORD_CHANGE_OTP_REQUESTED,
      this.userToJwtPayload(user),
      `User ${user.fullName} requested password change OTP`,
      {
        requestedUser: {
          id: userId,
          referenceId: user.referenceId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          country: user.country,
        },
      },
    );

    await this.mailService.sendPasswordChangeOtpEmail(
      user.fullName,
      user.email,
      otp,
    );
  }

  async confirmPasswordChange(
    userId: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException(messages.userNotFound);
    }
    const otpRecord = await this.prisma.passwordChangeOtp.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (
      !otpRecord ||
      otpRecord.token !== otp ||
      otpRecord.validUntil < new Date()
    ) {
      throw new BadRequestException(messages.invalidOtp);
    }

    await this.prisma.$transaction([
      this.prisma.passwordChangeOtp.delete({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 10),
          updatedAt: new Date(),
        },
      }),
    ]);

    await this.mailService.sendPasswordChangeInfoEmail(
      otpRecord.user.email,
      otpRecord.user.fullName,
      new Date(),
    );

    await this.activityLogService.createActivityLog(
      userId,
      'USER',
      ActivityType.USER_PASSWORD_CHANGED,
      this.userToJwtPayload(otpRecord.user),
      `User ${otpRecord.user.fullName} changed password via OTP`,
      {
        changedUser: {
          id: userId,
          referenceId: otpRecord.user.referenceId,
          updatedAt: new Date(),
        },
      },
    );
  }

  async changePassword(
    changePasswordRequest: ChangePasswordRequest,
    userId: string,
    name: string,
    email: string,
  ): Promise<void> {
    try {
      const updatedAt = new Date();
      await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          throw new NotFoundException(messages.userNotFound);
        }
        await prisma.user.update({
          where: { id: userId },
          data: {
            passwordHash: await bcrypt.hash(
              changePasswordRequest.newPassword,
              10,
            ),
            updatedAt,
          },
        });

        await this.mailService.sendPasswordChangeInfoEmail(
          email,
          name,
          updatedAt,
        );
        await this.activityLogService.createActivityLog(
          userId,
          'USER',
          ActivityType.USER_PASSWORD_CHANGED,
          this.userToJwtPayload(user),
          `User ${user.fullName} changed password`,
          {
            changedUser: {
              id: userId,
              referenceId: user.referenceId,
              updatedAt,
            },
          },
        );
      });
    } catch (error) {
      throw error;
    }
  }

  async validateUser(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      throw new UnauthorizedException(messages.userNotFoundOrNotVerified);
    }

    if (!user.verificationDate) {
      throw new UnauthorizedException(messages.userNotVerified);
    }

    if (user.email !== payload.email) {
      throw new UnauthorizedException(messages.invalidToken);
    }

    return user;
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { email: true },
    });
    return user === null;
  }

  async refreshTokens(
    refreshToken: string,
    username: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      if (this.phoneNumberRegex.test(username)) {
        username = username.toLowerCase();
      } else if (this.emailRegex.test(username)) {
        username = username.toLowerCase();
      } else {
        const lowerCaseUsername = username.toLowerCase();
        username = lowerCaseUsername;
      }

      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            { phoneNumber: username },
            { email: username },
            { referenceId: username },
          ],
        },
        select: {
          id: true,
          email: true,
          phoneNumber: true,
          referenceId: true,
          role: true,
          status: true,
          verificationDate: true,
        },
      });

      if (!user) {
        throw new NotFoundException(messages.userNotFound);
      }

      if (!user.verificationDate) {
        throw new UnauthorizedException(messages.userNotVerified);
      }
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtRefreshSecret,
        ignoreExpiration: false,
      });

      if (payload.id !== user.id || payload.email !== user.email) {
        throw new UnauthorizedException(messages.invalidRefreshToken);
      }

      const tokens = this.generateTokens(
        user.id,
        user.email,
        user.phoneNumber,
        user.referenceId,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException(messages.refreshTokenExpired);
      }
      throw new UnauthorizedException(messages.invalidRefreshToken);
    }
  }

  async checkMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        referenceId: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        dob: true,
        gender: true,
        country: true,
        verificationDate: true,
        isActive: true,
        status: true,
        rejectedReason: true,
        bio: true,
        website: true,
        userConfig: {
          select: {
            config: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        deletedAt: true,

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
        referrer: {
          select: {
            id: true,
            role: true,
            referenceId: true,
            email: true,
            fullName: true,
            phoneNumber: true,
            dob: true,
            gender: true,
            country: true,
            verificationDate: true,
            isActive: true,
            status: true,
            rejectedReason: true,
            bio: true,
            website: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,

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
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(messages.userNotFound);
    }

    if (!user.verificationDate) {
      throw new UnauthorizedException(messages.userNotVerified);
    }

    return user;
  }
}
