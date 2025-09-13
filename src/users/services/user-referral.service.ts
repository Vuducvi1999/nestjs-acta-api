import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { JwtPayload } from '../../auth/jwt-payload';
import { PrismaService } from '../../common/services/prisma.service';
import { messages } from '../../constants/messages';
import { ReferralUserResponseDto } from '../dto/referral-user-response.dto';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UserReferralService {
  private readonly logger = new Logger(UserReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Helper method to check if a user is admin and fetch their role from Prisma
   */
  private async checkUserRole(
    userId: string,
  ): Promise<{ isAdmin: boolean; role: string | null }> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isAdmin = currentUser?.role === 'admin';
    this.logger.log(
      `[PERFORMANCE] User role check completed - User: ${userId}, Role: ${currentUser?.role}, IsAdmin: ${isAdmin}`,
    );

    return { isAdmin, role: currentUser?.role || null };
  }

  /**
   * Recursively gathers all referenceIds in the referral tree
   * starting from the given root referenceId, limited to 2 levels deep.
   */
  async getReferralTreeReferenceIds(referenceId: string): Promise<Set<string>> {
    const methodStartTime = Date.now();

    const closures = await this.prisma.userReferralClosure.findMany({
      where: {
        ancestorId: referenceId,
        depth: { lte: 2 },
      },
      select: { descendantId: true },
    });

    const result = new Set(closures.map((c) => c.descendantId));

    this.logger.log(
      `[PERFORMANCE] getReferralTreeReferenceIds completed via closure table - Total time: ${Date.now() - methodStartTime}ms, Found ${result.size} IDs`,
    );

    return result;
  }

  /**
   * Fetches referral users for a specific user with proper access control
   */
  async getReferralUsers(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
    referralType: 'all' | 'direct' | 'indirect' = 'all',
    searchTerm?: string,
    status?: string,
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] getReferralUsers started - User: ${user.referenceId}, Target: ${userId}, Type: ${referralType}`,
    );

    const { page, limit } = paginationOptions || { page: 1, limit: 20 };

    // Check if current user is admin by fetching from Prisma
    const { isAdmin } = await this.checkUserRole(user.id);
    const cacheKey = `referral-users:${userId}:${user.referenceId}:${page}:${limit}:${referralType}:${isAdmin ? 'admin' : 'user'}:${searchTerm || ''}:${status || 'all'}`;

    // Cache check timing
    const cacheStartTime = Date.now();
    const cachedResult = await this.cacheManager.get<{
      data: ReferralUserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);
    const cacheEndTime = Date.now();

    if (cachedResult) {
      this.logger.log(
        `[PERFORMANCE] Cache hit for referral users: ${cacheKey} - Time: ${cacheEndTime - cacheStartTime}ms`,
      );
      this.logger.log(
        `[PERFORMANCE] getReferralUsers completed (cached) - Total time: ${Date.now() - methodStartTime}ms`,
      );
      return cachedResult;
    }

    this.logger.log(
      `[PERFORMANCE] Cache miss for referral users: ${cacheKey} - Time: ${cacheEndTime - cacheStartTime}ms`,
    );

    // Target user query timing
    const targetUserStartTime = Date.now();
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referenceId: true },
    });
    const targetUserEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Target user query completed - Time: ${targetUserEndTime - targetUserStartTime}ms`,
    );

    if (!targetUser) throw new NotFoundException(messages.userNotFound);

    // ADMIN BYPASS: If the requesting user is admin, skip hierarchy checks
    let allowedReferenceIds: Set<string>;

    if (isAdmin) {
      this.logger.log(
        `[PERFORMANCE] Admin bypass - User ${user.referenceId} is admin, skipping hierarchy checks`,
      );
      // For admin, we'll allow access to all users, so we don't need to filter by allowedReferenceIds
      allowedReferenceIds = new Set<string>(); // Empty set means no filtering
    } else {
      // Referral tree query timing for non-admin users
      const referralTreeStartTime = Date.now();
      allowedReferenceIds = await this.getReferralTreeReferenceIds(
        user.referenceId,
      );
      const referralTreeEndTime = Date.now();
      this.logger.log(
        `[PERFORMANCE] Referral tree query completed - Time: ${referralTreeEndTime - referralTreeStartTime}ms, Found ${allowedReferenceIds.size} allowed references`,
      );

      if (!allowedReferenceIds.has(targetUser.referenceId)) {
        this.logger.log(
          `[PERFORMANCE] Access denied - User not in allowed hierarchy - Total time: ${Date.now() - methodStartTime}ms`,
        );
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        };
      }
    }

    // Max depth calculation timing
    const maxDepthStartTime = Date.now();
    const maxDepth = await this.calculateMaxDepth(userId, user.referenceId);
    const maxDepthEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Max depth calculation completed - Time: ${maxDepthEndTime - maxDepthStartTime}ms, Max depth: ${maxDepth}`,
    );

    const selectQuery = this.buildReferralSelectQuery(maxDepth);

    // Main referral users query timing
    const mainQueryStartTime = Date.now();
    const allReferralUsers = await this.prisma.user.findMany({
      where: {
        referrerId: targetUser.referenceId,
        ...(searchTerm
          ? {
              OR: [
                { fullName: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
                { referenceId: { contains: searchTerm, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(status && status !== 'all' ? { status: status as UserStatus } : {}),
      },
      select: selectQuery,
      orderBy: [
        {
          referrals: {
            _count: 'desc',
          },
        },
        {
          status: 'asc',
        },
        {
          verificationDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
    const mainQueryEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Main referral users query completed - Time: ${mainQueryEndTime - mainQueryStartTime}ms, Found ${allReferralUsers.length} users`,
    );

    // Filtering timing
    const filterStartTime = Date.now();
    let filtered;
    if (isAdmin) {
      // For admin, no filtering needed - show all users
      filtered = allReferralUsers;
      this.logger.log(
        `[PERFORMANCE] Admin bypass - No filtering applied, showing all ${filtered.length} users`,
      );
    } else {
      // For non-admin users, apply hierarchy filtering
      filtered = allReferralUsers.filter((u) =>
        allowedReferenceIds.has(u.referenceId),
      );
    }
    const filterEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Filtering completed - Time: ${filterEndTime - filterStartTime}ms, Filtered to ${filtered.length} users`,
    );

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paginatedUsers = filtered.slice(skip, skip + limit);

    // Data transformation timing
    const transformStartTime = Date.now();
    const data = paginatedUsers.map((u) => {
      return ReferralUserResponseDto.fromPrisma(u, allowedReferenceIds);
    });
    const transformEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Data transformation completed - Time: ${transformEndTime - transformStartTime}ms, Transformed ${data.length} users`,
    );

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const result = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };

    // Cache set timing
    const cacheSetStartTime = Date.now();
    await this.cacheManager.set(cacheKey, result, 1000 * 15);
    const cacheSetEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Cache set completed - Time: ${cacheSetEndTime - cacheSetStartTime}ms`,
    );

    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] getReferralUsers completed - User ${user.referenceId} viewing ${targetUser.referenceId} referrals - Total time: ${totalTime}ms`,
    );

    return result;
  }

  async getPaginatedIndirectReferrals(
    parentUserId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const { page, limit } = paginationOptions || { page: 1, limit: 5 };
    const cacheKey = `indirect-referrals:${parentUserId}:${user.referenceId}:${page}:${limit}`;

    const cached = await this.cacheManager.get<typeof result>(cacheKey);
    if (cached) return cached;

    const parentUser = await this.prisma.user.findUnique({
      where: { id: parentUserId },
      select: { referenceId: true },
    });
    if (!parentUser) throw new NotFoundException(messages.userNotFound);

    // Validate parent is a direct referral of current user
    const closure = await this.prisma.userReferralClosure.findUnique({
      where: {
        ancestorId_descendantId: {
          ancestorId: user.referenceId,
          descendantId: parentUser.referenceId,
        },
      },
      select: { depth: true },
    });

    if (!closure || closure.depth !== 1) {
      // Parent must be direct referral (depth 1)
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };
    }

    // Now fetch descendants of parentUser (i.e. indirect referrals from current user's PoV)
    const indirectClosures = await this.prisma.userReferralClosure.findMany({
      where: {
        ancestorId: parentUser.referenceId,
        depth: 1,
      },
      select: { descendantId: true },
    });

    const indirectReferenceIds = indirectClosures.map((c) => c.descendantId);

    if (!indirectReferenceIds.length) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          referenceId: { in: indirectReferenceIds },
        },
        select: this.buildReferralSelectQuery(0), // full user data
        orderBy: [
          { status: 'asc' },
          { referrals: { _count: 'desc' } },
          { verificationDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where: {
          referenceId: { in: indirectReferenceIds },
        },
      }),
    ]);

    const data = users.map((u) =>
      ReferralUserResponseDto.fromPrisma(u, new Set(indirectReferenceIds)),
    );

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const result = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };

    await this.cacheManager.set(cacheKey, result, 300);

    this.logger.log(
      `[PERFORMANCE] getPaginatedIndirectReferrals - User ${user.referenceId} viewing indirect referrals of ${parentUser.referenceId} (depth 2)`,
    );

    return result;
  }

  /**
   * Get only direct referrals for a specific user
   */
  async getDirectReferrals(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
    searchTerm?: string,
    status?: string,
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] getDirectReferrals started - User: ${user.referenceId}, Target: ${userId}`,
    );

    const { page, limit } = paginationOptions || { page: 1, limit: 20 };

    // Check if current user is admin by fetching from Prisma
    const { isAdmin } = await this.checkUserRole(user.id);
    const cacheKey = `direct-referrals:${userId}:${user.referenceId}:${page}:${limit}:${isAdmin ? 'admin' : 'user'}:${searchTerm || ''}:${status || 'all'}`;

    // Cache check timing
    const cacheStartTime = Date.now();
    const cachedResult = await this.cacheManager.get<{
      data: ReferralUserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);
    const cacheEndTime = Date.now();

    if (cachedResult) {
      this.logger.log(
        `[PERFORMANCE] Cache hit for direct referrals: ${cacheKey} - Time: ${cacheEndTime - cacheStartTime}ms`,
      );
      this.logger.log(
        `[PERFORMANCE] getDirectReferrals completed (cached) - Total time: ${Date.now() - methodStartTime}ms`,
      );
      return cachedResult;
    }

    this.logger.log(
      `[PERFORMANCE] Cache miss for direct referrals: ${cacheKey} - Time: ${cacheEndTime - cacheStartTime}ms`,
    );

    // Target user query timing
    const targetUserStartTime = Date.now();
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referenceId: true },
    });
    const targetUserEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Target user query completed - Time: ${targetUserEndTime - targetUserStartTime}ms`,
    );

    if (!targetUser) throw new NotFoundException(messages.userNotFound);

    // ADMIN BYPASS: If the requesting user is admin, skip hierarchy checks
    let allowedReferenceIds: Set<string>;

    if (isAdmin) {
      this.logger.log(
        `[PERFORMANCE] Admin bypass - User ${user.referenceId} is admin, skipping hierarchy checks`,
      );
      // For admin, we'll allow access to all users, so we don't need to filter by allowedReferenceIds
      allowedReferenceIds = new Set<string>(); // Empty set means no filtering
    } else {
      // Referral tree query timing for non-admin users
      const referralTreeStartTime = Date.now();
      allowedReferenceIds = await this.getReferralTreeReferenceIds(
        user.referenceId,
      );
      const referralTreeEndTime = Date.now();
      this.logger.log(
        `[PERFORMANCE] Referral tree query completed - Time: ${referralTreeEndTime - referralTreeStartTime}ms, Found ${allowedReferenceIds.size} allowed references`,
      );

      if (!allowedReferenceIds.has(targetUser.referenceId)) {
        this.logger.log(
          `[PERFORMANCE] Access denied - User not in allowed hierarchy - Total time: ${Date.now() - methodStartTime}ms`,
        );
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        };
      }
    }

    const selectQuery = {
      id: true,
      role: true,
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
      verificationDate: true,
      isActive: true,
      status: true,
      rejectedReason: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      _count: {
        select: {
          referrals: true,
        },
      },
    };

    // Main direct referrals query timing
    const mainQueryStartTime = Date.now();
    const allDirectReferrals = await this.prisma.user.findMany({
      where: {
        referrerId: targetUser.referenceId,
        ...(searchTerm
          ? {
              OR: [
                { fullName: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
                { referenceId: { contains: searchTerm, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(status && status !== 'all' ? { status: status as UserStatus } : {}),
      },
      select: selectQuery,
      orderBy: [
        {
          status: 'asc',
        },
        {
          referrals: {
            _count: 'desc',
          },
        },
        {
          verificationDate: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
    const mainQueryEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Main direct referrals query completed - Time: ${mainQueryEndTime - mainQueryStartTime}ms, Found ${allDirectReferrals.length} users`,
    );

    // Filtering timing
    const filterStartTime = Date.now();
    let filtered;
    if (isAdmin) {
      // For admin, no filtering needed - show all users
      filtered = allDirectReferrals;
      this.logger.log(
        `[PERFORMANCE] Admin bypass - No filtering applied, showing all ${filtered.length} users`,
      );
    } else {
      // For non-admin users, apply hierarchy filtering
      filtered = allDirectReferrals.filter((u) =>
        allowedReferenceIds.has(u.referenceId),
      );
    }
    const filterEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Filtering completed - Time: ${filterEndTime - filterStartTime}ms, Filtered to ${filtered.length} users`,
    );

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paginatedUsers = filtered.slice(skip, skip + limit);

    // Data transformation timing
    const transformStartTime = Date.now();
    const data = paginatedUsers.map((u) => {
      return ReferralUserResponseDto.fromPrisma(u, allowedReferenceIds);
    });
    const transformEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Data transformation completed - Time: ${transformEndTime - transformStartTime}ms, Transformed ${data.length} users`,
    );

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const result = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };

    // Cache set timing
    const cacheSetStartTime = Date.now();
    await this.cacheManager.set(cacheKey, result, 300);
    const cacheSetEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Cache set completed - Time: ${cacheSetEndTime - cacheSetStartTime}ms`,
    );

    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] getDirectReferrals completed - User ${user.referenceId} viewing ${targetUser.referenceId} direct referrals - Total time: ${totalTime}ms`,
    );

    return result;
  }

  /**
   * Get all indirect referrals for a specific user (referrals of direct referrals)
   */
  async getIndirectReferrals(
    userId: string,
    user: JwtPayload,
    paginationOptions?: { page: number; limit: number },
    searchTerm?: string,
    status?: string,
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] getIndirectReferrals started - User: ${user.referenceId}, Target: ${userId}`,
    );

    const { page, limit } = paginationOptions || { page: 1, limit: 20 };

    // Check if current user is admin by fetching from Prisma
    const { isAdmin } = await this.checkUserRole(user.id);
    const cacheKey = `indirect-referrals:${userId}:${user.referenceId}:${page}:${limit}:${isAdmin ? 'admin' : 'user'}:${searchTerm || ''}:${status || 'all'}`;

    // Cache check timing
    const cacheStartTime = Date.now();
    const cachedResult = await this.cacheManager.get<{
      data: ReferralUserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);
    const cacheEndTime = Date.now();

    if (cachedResult) {
      this.logger.log(
        `[PERFORMANCE] Cache hit for indirect referrals: ${cacheKey} - Time: ${cacheEndTime - cacheStartTime}ms`,
      );
      this.logger.log(
        `[PERFORMANCE] getIndirectReferrals completed (cached) - Total time: ${Date.now() - methodStartTime}ms`,
      );
      return cachedResult;
    }

    this.logger.log(
      `[PERFORMANCE] Cache miss for indirect referrals: ${cacheKey} - Time: ${cacheEndTime - cacheStartTime}ms`,
    );

    // Target user query timing
    const targetUserStartTime = Date.now();
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referenceId: true },
    });
    const targetUserEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Target user query completed - Time: ${targetUserEndTime - targetUserStartTime}ms`,
    );

    if (!targetUser) throw new NotFoundException(messages.userNotFound);

    // ADMIN BYPASS: If the requesting user is admin, skip hierarchy checks
    let allowedReferenceIds: Set<string>;

    if (isAdmin) {
      this.logger.log(
        `[PERFORMANCE] Admin bypass - User ${user.referenceId} is admin, skipping hierarchy checks`,
      );
      // For admin, we'll allow access to all users, so we don't need to filter by allowedReferenceIds
      allowedReferenceIds = new Set<string>(); // Empty set means no filtering
    } else {
      // Referral tree query timing for non-admin users
      const referralTreeStartTime = Date.now();
      allowedReferenceIds = await this.getReferralTreeReferenceIds(
        user.referenceId,
      );
      const referralTreeEndTime = Date.now();
      this.logger.log(
        `[PERFORMANCE] Referral tree query completed - Time: ${referralTreeEndTime - referralTreeStartTime}ms, Found ${allowedReferenceIds.size} allowed references`,
      );

      if (!allowedReferenceIds.has(targetUser.referenceId)) {
        this.logger.log(
          `[PERFORMANCE] Access denied - User not in allowed hierarchy - Total time: ${Date.now() - methodStartTime}ms`,
        );
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        };
      }
    }

    // Direct referrals query timing
    const directReferralsStartTime = Date.now();
    const directReferrals = await this.prisma.user.findMany({
      where: {
        referrerId: targetUser.referenceId,
        ...(searchTerm
          ? {
              OR: [
                { fullName: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phoneNumber: { contains: searchTerm, mode: 'insensitive' } },
                { referenceId: { contains: searchTerm, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { referenceId: true },
    });
    const directReferralsEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Direct referrals query completed - Time: ${directReferralsEndTime - directReferralsStartTime}ms, Found ${directReferrals.length} direct referrals`,
    );

    let allIndirectReferrals: any[] = [];

    if (directReferrals.length > 0) {
      const directReferenceIds = directReferrals.map((r) => r.referenceId);

      // Indirect referrals query timing
      const indirectReferralsStartTime = Date.now();
      allIndirectReferrals = await this.prisma.user.findMany({
        where: {
          referrerId: {
            in: directReferenceIds,
          },
          ...(searchTerm
            ? {
                OR: [
                  { fullName: { contains: searchTerm, mode: 'insensitive' } },
                  { email: { contains: searchTerm, mode: 'insensitive' } },
                  {
                    phoneNumber: { contains: searchTerm, mode: 'insensitive' },
                  },
                  {
                    referenceId: { contains: searchTerm, mode: 'insensitive' },
                  },
                ],
              }
            : {}),
          ...(status && status !== 'all'
            ? { status: status as UserStatus }
            : {}),
        },
        select: {
          id: true,
          role: true,
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
          verificationDate: true,
          isActive: true,
          status: true,
          rejectedReason: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          _count: {
            select: {
              referrals: true,
            },
          },
        },
        orderBy: [
          {
            status: 'asc',
          },
          {
            referrals: {
              _count: 'desc',
            },
          },
          {
            verificationDate: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
      });
      const indirectReferralsEndTime = Date.now();
      this.logger.log(
        `[PERFORMANCE] Indirect referrals query completed - Time: ${indirectReferralsEndTime - indirectReferralsStartTime}ms, Found ${allIndirectReferrals.length} indirect referrals`,
      );
    } else {
      this.logger.log(
        `[PERFORMANCE] No direct referrals found, skipping indirect referrals query`,
      );
    }

    // Filtering timing
    const filterStartTime = Date.now();
    let filtered;
    if (isAdmin) {
      // For admin, no filtering needed - show all users
      filtered = allIndirectReferrals;
      this.logger.log(
        `[PERFORMANCE] Admin bypass - No filtering applied, showing all ${filtered.length} users`,
      );
    } else {
      // For non-admin users, apply hierarchy filtering
      filtered = allIndirectReferrals.filter((u) =>
        allowedReferenceIds.has(u.referenceId),
      );
    }
    const filterEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Filtering completed - Time: ${filterEndTime - filterStartTime}ms, Filtered to ${filtered.length} users`,
    );

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paginatedUsers = filtered.slice(skip, skip + limit);

    // Data transformation timing
    const transformStartTime = Date.now();
    const data = paginatedUsers.map((u) => {
      return ReferralUserResponseDto.fromPrisma(u, allowedReferenceIds);
    });
    const transformEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Data transformation completed - Time: ${transformEndTime - transformStartTime}ms, Transformed ${data.length} users`,
    );

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const result = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };

    // Cache set timing
    const cacheSetStartTime = Date.now();
    await this.cacheManager.set(cacheKey, result, 300);
    const cacheSetEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Cache set completed - Time: ${cacheSetEndTime - cacheSetStartTime}ms`,
    );

    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] getIndirectReferrals completed - User ${user.referenceId} viewing ${targetUser.referenceId} indirect referrals - Total time: ${totalTime}ms`,
    );

    return result;
  }

  /**
   * Validates if a user is in the referral hierarchy of another user
   */
  private async validateReferralHierarchy(
    targetUserId: string,
    currentUserReferenceId: string,
  ): Promise<{ isInHierarchy: boolean; depth: number }> {
    const methodStartTime = Date.now();

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { referenceId: true },
    });

    if (!targetUser) {
      this.logger.warn(
        `[PERFORMANCE] validateReferralHierarchy: target not found`,
      );
      return { isInHierarchy: false, depth: 0 };
    }

    const closure = await this.prisma.userReferralClosure.findUnique({
      where: {
        ancestorId_descendantId: {
          ancestorId: currentUserReferenceId,
          descendantId: targetUser.referenceId,
        },
      },
      select: { depth: true },
    });

    const totalTime = Date.now() - methodStartTime;

    if (!closure) {
      this.logger.log(
        `[PERFORMANCE] validateReferralHierarchy: not in hierarchy - ${totalTime}ms`,
      );
      return { isInHierarchy: false, depth: 0 };
    }

    this.logger.log(
      `[PERFORMANCE] validateReferralHierarchy: in hierarchy at depth ${closure.depth} - ${totalTime}ms`,
    );
    return { isInHierarchy: true, depth: closure.depth };
  }

  /**
   * Calculates the maximum depth of referrals a user can view
   */
  private async calculateMaxDepth(
    targetUserId: string,
    currentUserReferenceId: string,
  ): Promise<number> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] calculateMaxDepth started - Target: ${targetUserId}, Current: ${currentUserReferenceId}`,
    );

    const currentUserStartTime = Date.now();
    const currentUser = await this.prisma.user.findUnique({
      where: { referenceId: currentUserReferenceId },
      select: { id: true },
    });
    const currentUserEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Current user query completed - Time: ${currentUserEndTime - currentUserStartTime}ms`,
    );

    if (currentUser && currentUser.id === targetUserId) {
      this.logger.log(
        `[PERFORMANCE] calculateMaxDepth completed (same user) - Total time: ${Date.now() - methodStartTime}ms, Max depth: 2`,
      );
      return 2;
    }

    const hierarchyCheckStartTime = Date.now();
    const hierarchyCheck = await this.validateReferralHierarchy(
      targetUserId,
      currentUserReferenceId,
    );
    const hierarchyCheckEndTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] Hierarchy check completed - Time: ${hierarchyCheckEndTime - hierarchyCheckStartTime}ms, Is in hierarchy: ${hierarchyCheck.isInHierarchy}, Depth: ${hierarchyCheck.depth}`,
    );

    if (!hierarchyCheck.isInHierarchy) {
      this.logger.log(
        `[PERFORMANCE] calculateMaxDepth completed (not in hierarchy) - Total time: ${Date.now() - methodStartTime}ms, Max depth: 0`,
      );
      return 0;
    }

    const maxDepth = Math.max(0, 2 - hierarchyCheck.depth);
    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] calculateMaxDepth completed - Total time: ${totalTime}ms, Max depth: ${maxDepth}`,
    );

    return maxDepth;
  }

  /**
   * Builds the select query based on the maximum depth allowed
   */
  private buildReferralSelectQuery(maxDepth: number) {
    const baseSelect = {
      id: true,
      role: true,
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
      verificationDate: true,
      isActive: true,
      status: true,
      rejectedReason: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      _count: {
        select: {
          referrals: true,
        },
      },
    };

    return baseSelect;
  }

  /**
   * Admin version: Get referral users without hierarchy restrictions
   */
  async getAdminReferralUsers(
    userId: string,
    paginationOptions?: { page: number; limit: number },
    referralType: 'all' | 'direct' | 'indirect' = 'all',
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] getAdminReferralUsers started - Target: ${userId}, Type: ${referralType}`,
    );

    const { page, limit } = paginationOptions || { page: 1, limit: 20 };
    const cacheKey = `admin-referral-users:${userId}:${page}:${limit}:${referralType}`;

    // Cache check
    const cachedResult = await this.cacheManager.get<{
      data: ReferralUserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);

    if (cachedResult) {
      this.logger.log(
        `[PERFORMANCE] Cache hit for admin referral users: ${cacheKey}`,
      );
      return cachedResult;
    }

    // Target user query
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referenceId: true },
    });

    if (!targetUser) throw new NotFoundException(messages.userNotFound);

    let result;

    switch (referralType) {
      case 'direct':
        result = await this.getAdminDirectReferrals(userId, paginationOptions);
        break;
      case 'indirect':
        result = await this.getAdminIndirectReferrals(
          userId,
          paginationOptions,
        );
        break;
      case 'all':
      default:
        // For 'all', we get both direct and indirect, but paginated together
        const directResult = await this.getAdminDirectReferrals(userId, {
          page: 1,
          limit: 1000,
        });
        const indirectResult = await this.getAdminIndirectReferrals(userId, {
          page: 1,
          limit: 1000,
        });

        const allUsers = [...directResult.data, ...indirectResult.data];
        const total = allUsers.length;
        const skip = (page - 1) * limit;
        const paginatedUsers = allUsers.slice(skip, skip + limit);

        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        result = {
          data: paginatedUsers,
          total,
          page,
          limit,
          totalPages,
          hasNext,
          hasPrev,
        };
        break;
    }

    // Cache the result
    await this.cacheManager.set(cacheKey, result, 300);

    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] getAdminReferralUsers completed - Total time: ${totalTime}ms`,
    );

    return result;
  }

  /**
   * Admin version: Get only direct referrals without hierarchy checks
   */
  async getAdminDirectReferrals(
    userId: string,
    paginationOptions?: { page: number; limit: number },
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] getAdminDirectReferrals started - Target: ${userId}`,
    );

    const { page, limit } = paginationOptions || { page: 1, limit: 20 };
    const cacheKey = `admin-direct-referrals:${userId}:${page}:${limit}`;

    // Cache check
    const cachedResult = await this.cacheManager.get<{
      data: ReferralUserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);

    if (cachedResult) {
      this.logger.log(
        `[PERFORMANCE] Cache hit for admin direct referrals: ${cacheKey}`,
      );
      return cachedResult;
    }

    // Target user query
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referenceId: true },
    });

    if (!targetUser) throw new NotFoundException(messages.userNotFound);

    const selectQuery = {
      id: true,
      role: true,
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
      verificationDate: true,
      isActive: true,
      status: true,
      rejectedReason: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      _count: {
        select: {
          referrals: true,
        },
      },
    };

    const skip = (page - 1) * limit;

    // Get direct referrals with pagination
    const [allDirectReferrals, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          referrerId: targetUser.referenceId,
          deletedAt: null,
        },
        select: selectQuery,
        orderBy: [
          { status: 'asc' },
          { referrals: { _count: 'desc' } },
          { verificationDate: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where: {
          referrerId: targetUser.referenceId,
          deletedAt: null,
        },
      }),
    ]);

    // Transform data - create a dummy allowedReferenceIds set for admin (all are allowed)
    const allReferenceIds = new Set(
      allDirectReferrals.map((u) => u.referenceId),
    );
    const data = allDirectReferrals.map((u) => {
      return ReferralUserResponseDto.fromPrisma(u, allReferenceIds);
    });

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const result = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };

    // Cache the result
    await this.cacheManager.set(cacheKey, result, 300);

    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] getAdminDirectReferrals completed - Total time: ${totalTime}ms`,
    );

    return result;
  }

  /**
   * Admin version: Get all indirect referrals without hierarchy checks
   */
  async getAdminIndirectReferrals(
    userId: string,
    paginationOptions?: { page: number; limit: number },
  ): Promise<{
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const methodStartTime = Date.now();
    this.logger.log(
      `[PERFORMANCE] getAdminIndirectReferrals started - Target: ${userId}`,
    );

    const { page, limit } = paginationOptions || { page: 1, limit: 20 };
    const cacheKey = `admin-indirect-referrals:${userId}:${page}:${limit}`;

    // Cache check
    const cachedResult = await this.cacheManager.get<{
      data: ReferralUserResponseDto[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    }>(cacheKey);

    if (cachedResult) {
      this.logger.log(
        `[PERFORMANCE] Cache hit for admin indirect referrals: ${cacheKey}`,
      );
      return cachedResult;
    }

    // Target user query
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referenceId: true },
    });

    if (!targetUser) throw new NotFoundException(messages.userNotFound);

    // First, get all direct referrals
    const directReferrals = await this.prisma.user.findMany({
      where: {
        referrerId: targetUser.referenceId,
        deletedAt: null,
      },
      select: { referenceId: true },
    });

    let allIndirectReferrals: any[] = [];
    let total = 0;

    if (directReferrals.length > 0) {
      const directReferenceIds = directReferrals.map((r) => r.referenceId);
      const skip = (page - 1) * limit;

      // Get indirect referrals with pagination
      [allIndirectReferrals, total] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            referrerId: {
              in: directReferenceIds,
            },
            deletedAt: null,
          },
          select: {
            id: true,
            role: true,
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
            verificationDate: true,
            isActive: true,
            status: true,
            rejectedReason: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            _count: {
              select: {
                referrals: true,
              },
            },
          },
          orderBy: [
            { status: 'asc' },
            { referrals: { _count: 'desc' } },
            { verificationDate: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        this.prisma.user.count({
          where: {
            referrerId: {
              in: directReferenceIds,
            },
            deletedAt: null,
          },
        }),
      ]);
    }

    // Transform data - create a dummy allowedReferenceIds set for admin (all are allowed)
    const allReferenceIds = new Set(
      allIndirectReferrals.map((u) => u.referenceId),
    );
    const data = allIndirectReferrals.map((u) => {
      return ReferralUserResponseDto.fromPrisma(u, allReferenceIds);
    });

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const result = {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };

    // Cache the result
    await this.cacheManager.set(cacheKey, result, 300);

    const totalTime = Date.now() - methodStartTime;
    this.logger.log(
      `[PERFORMANCE] getAdminIndirectReferrals completed - Total time: ${totalTime}ms`,
    );

    return result;
  }

  /**
   * Invalidate referral cache when user data changes
   */
  async invalidateReferralCache(userReferenceId: string) {
    try {
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
        await this.cacheManager.del(pattern);
      }

      this.logger.log(`Cache invalidated for user: ${userReferenceId}`);
    } catch (error) {
      this.logger.error('Error invalidating cache:', error);
    }
  }
}
