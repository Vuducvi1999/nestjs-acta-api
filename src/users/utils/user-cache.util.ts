import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class UserCacheUtil {
  private readonly logger = new Logger(UserCacheUtil.name);
  private readonly CACHE_TTL = 120 * 1000; // 2 minutes in milliseconds

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async getCachedData<T>(cacheKey: string): Promise<T | null> {
    try {
      return (await this.cacheManager.get<T>(cacheKey)) || null;
    } catch (error) {
      this.logger.error(
        `Error getting cached data for key: ${cacheKey}`,
        error,
      );
      return null;
    }
  }

  async setCachedData<T>(
    cacheKey: string,
    data: T,
    ttl?: number,
  ): Promise<void> {
    try {
      await this.cacheManager.set(cacheKey, data, ttl || this.CACHE_TTL);
    } catch (error) {
      this.logger.error(
        `Error setting cached data for key: ${cacheKey}`,
        error,
      );
    }
  }

  async invalidateCache(pattern: string): Promise<void> {
    try {
      await this.cacheManager.del(pattern);
      this.logger.log(`Cache invalidated for pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating cache for pattern: ${pattern}`,
        error,
      );
    }
  }

  async invalidateUserCache(userReferenceId: string): Promise<void> {
    const patterns = [
      `referral-users:*:${userReferenceId}`,
      `referral-users:${userReferenceId}:*`,
      `direct-referrals:*:${userReferenceId}`,
      `direct-referrals:${userReferenceId}:*`,
      `indirect-referrals:*:${userReferenceId}`,
      `indirect-referrals:${userReferenceId}:*`,
      `user-profile:${userReferenceId}`,
    ];

    for (const pattern of patterns) {
      await this.invalidateCache(pattern);
    }

    this.logger.log(`Cache invalidated for user: ${userReferenceId}`);
  }

  generateCacheKey(prefix: string, ...params: (string | number)[]): string {
    return `${prefix}:${params.join(':')}`;
  }
}
