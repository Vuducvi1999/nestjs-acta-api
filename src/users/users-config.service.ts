import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../common/services/prisma.service';
import { USER_CONFIG_KEYS } from './models/user-config.constant';
import { ActivityLogService } from '../activity-logs/activity-log.service';
import { ActivityTargetType, ActivityType, UserStatus } from '@prisma/client';
import { tokenCacheKey } from '../auth/auth-utils';

export const defaultConfig = {
  [USER_CONFIG_KEYS.PROFILE_PRIVACY]: 'private',
  [USER_CONFIG_KEYS.EMAIL_SUBSCRIPTION]: true,
  [USER_CONFIG_KEYS.INFORMATION_PUBLICITY]: 'private',
  [USER_CONFIG_KEYS.NOTIFICATION_SETTINGS]: {
    push: true,
    sms: true,
  },
  [USER_CONFIG_KEYS.SECURITY_SETTINGS]: {
    twoFA: false,
  },
  [USER_CONFIG_KEYS.PAYMENT_METHODS]: [],
  [USER_CONFIG_KEYS.SHIPPING_PREFERENCES]: {},
  [USER_CONFIG_KEYS.LANGUAGE]: 'vi',
  [USER_CONFIG_KEYS.AVATAR_POSTS]: {
    enabled: true,
    postType: 'simple',
    autoPublish: true,
    includeComparison: false,
    customMessage: null,
    notifyFollowers: true,
  },
};

@Injectable()
export class UserConfigService {
  private readonly logger = new Logger(UserConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Runs after user complete verification
   * or if user does not have config on default (undefined)
   */

  async initialDefaultUserConfig(
    user: JwtPayload,
  ): Promise<Record<string, any>> {
    try {
      const userConfig = await this.prisma.userConfig.findUnique({
        where: { userId: user.id },
      });

      if (userConfig) return userConfig.config as Record<string, any>;

      const created = await this.prisma.userConfig.create({
        data: {
          userId: user.id,
          config: defaultConfig,
        },
      });

      return created.config as Record<string, any>;
    } catch (error) {
      this.logger.error('Error while initial default user config', error.stack);
      throw new InternalServerErrorException(
        'Error while initial default user config',
      );
    }
  }

  async getUserConfig(userId: string): Promise<Record<string, any>> {
    try {
      const userConfig = await this.prisma.userConfig.findUnique({
        where: { userId },
      });

      if (!userConfig) {
        throw new BadRequestException('User config not found');
      }

      return userConfig.config as Record<string, any>;
    } catch (error) {
      this.logger.error('Error while getting user config', error.stack);
      throw new InternalServerErrorException('Error while getting user config');
    }
  }

  async updateUserConfigKey(
    user: JwtPayload,
    key: string,
    value: any,
  ): Promise<void> {
    try {
      const existUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!existUser) {
        throw new BadRequestException('User not found');
      }

      if (existUser.status === UserStatus.inactive) {
        throw new BadRequestException('User is inactive');
      }

      const current = await this.prisma.userConfig.findUnique({
        where: { userId: user.id },
      });

      if (!current) {
        throw new Error('User config not found');
      }

      const oldConfig = current.config as Record<string, any>;
      const updatedConfig = {
        ...(current.config as Record<string, any>),
        [key]: value,
      };

      await this.prisma.userConfig.update({
        where: { userId: user.id },
        data: { config: updatedConfig },
      });

      // Invalidate user cache
      if (user.accessToken) {
        await this.cacheManager.del(tokenCacheKey(user.accessToken));
      }

      await this.activityLogService.createActivityLog(
        user.id,
        ActivityTargetType.USER,
        ActivityType.USER_CONFIG_UPDATED,
        existUser,
        `User ${existUser.fullName} updated their config`,
        {
          old: oldConfig,
          new: updatedConfig as Record<string, any>,
        },
      );

      this.logger.log(
        `User ${existUser.fullName} updated their config`,
        updatedConfig,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update config for user ${user.id}`,
        error.stack,
      );
      throw new InternalServerErrorException('Cập nhật cấu hình thất bại');
    }
  }
}
