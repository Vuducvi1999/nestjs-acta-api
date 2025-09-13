import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { UserQueryDto } from '../dto/user-query.dto';
import { UserResponse, UserReferenceResponse } from '../models';
import { PaginatedUserResponseDto } from '../dto/user-response.dto';
import { JwtPayload } from '../../auth/jwt-payload';

@Injectable()
export class UserSearchService {
  private readonly logger = new Logger(UserSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getSearchCondition(searchQuery: string) {
    return {
      OR: [
        {
          fullName: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          email: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          phoneNumber: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          referenceId: {
            contains: searchQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    };
  }

  private buildOrderBy(sortBy?: string): Prisma.UserOrderByWithRelationInput[] {
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [];

    if (sortBy) {
      const [field, order] = sortBy.split(':');
      if (
        field === 'fullName' ||
        field === 'email' ||
        field === 'createdAt' ||
        field === 'role'
      ) {
        orderBy.push({
          [field]: order as Prisma.SortOrder,
        });
      }
    }

    orderBy.push({ createdAt: 'desc' });
    return orderBy;
  }

  async findAll(query: UserQueryDto = {}): Promise<PaginatedUserResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {
        ...(query.status && { status: query.status as UserStatus }),
      };

      if (query.searchTerm) {
        Object.assign(where, this.getSearchCondition(query.searchTerm));
      }

      const orderBy = this.buildOrderBy(query.sortBy);

      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            avatar: true,
            referrer: {
              include: {
                avatar: true,
              },
            },
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      const result = PaginatedUserResponseDto.fromPaginatedResult({
        data,
        total,
        page,
        limit,
      });

      this.logger.log(
        `Users fetched successfully for query: ${JSON.stringify(query)}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error fetching users:', error);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findAllForAdmin(
    query: UserQueryDto = {},
  ): Promise<PaginatedUserResponseDto> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {
        ...(query.status && { status: query.status as UserStatus }),
      };

      if (query.searchTerm) {
        Object.assign(where, this.getSearchCondition(query.searchTerm));
      }

      const orderBy = this.buildOrderBy(query.sortBy);

      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            referenceId: true,
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
            createdAt: true,
            updatedAt: true,
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
                fullName: true,
                referenceId: true,
                avatar: {
                  select: {
                    fileUrl: true,
                  },
                },
              },
            },
            referrals: {
              where: {
                deletedAt: null,
              },
              select: {
                id: true,
                fullName: true,
                referenceId: true,
                email: true,
                phoneNumber: true,
                status: true,
                createdAt: true,
                avatar: {
                  select: {
                    fileUrl: true,
                  },
                },
                referrals: {
                  where: {
                    deletedAt: null,
                  },
                  select: {
                    id: true,
                    fullName: true,
                    referenceId: true,
                    email: true,
                    phoneNumber: true,
                    status: true,
                    createdAt: true,
                    avatar: {
                      select: {
                        fileUrl: true,
                      },
                    },
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
            business: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                logo: true,
                avatar: true,
                website: true,
                address: true,
                type: true,
                verified: true,
                isActive: true,
                joinDate: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            _count: {
              select: {
                referrals: {
                  where: {
                    deletedAt: null,
                  },
                },
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
        }),
        this.prisma.user.count({ where }),
      ]);

      const result = PaginatedUserResponseDto.fromPaginatedResult({
        data,
        total,
        page,
        limit,
      });

      this.logger.log(
        `Admin users fetched successfully for query: ${JSON.stringify(query)}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error fetching users for admin:', error);
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findSuggestUsers(user: any): Promise<UserResponse[]> {
    const users = await this.prisma.user.findMany({
      where: {
        NOT: {
          referrerId: user.referenceId,
        },
      },
      include: {
        avatar: true,
        cover: true,
      },
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((u) => UserResponse.fromUserEntity(u));
  }

  async searchVerifiedUsers(
    searchQuery: string,
    user: JwtPayload,
  ): Promise<UserReferenceResponse[]> {
    try {
      if (!searchQuery.trim()) {
        // If searchQuery is empty, return top 10 closest users in the referral tree
        // Only include users with a non-null verificationDate
        // Order by depth (asc), then createdAt (desc)
        // 1. Find all descendants within 2 levels (depth 1 or 2)
        const closures = await this.prisma.userReferralClosure.findMany({
          where: {
            ancestorId: user.referenceId,
            depth: { lte: 2, gte: 1 },
          },
          select: { descendantId: true, depth: true },
        });
        if (!closures.length) return [];
        // 2. Map descendantId to depth
        const descendantDepthMap = new Map<string, number>();
        closures.forEach((c) =>
          descendantDepthMap.set(c.descendantId, c.depth),
        );
        // 3. Fetch users by referenceId in descendantIds, with verificationDate not null
        const users = await this.prisma.user.findMany({
          where: {
            referenceId: { in: Array.from(descendantDepthMap.keys()) },
            verificationDate: { not: null },
          },
          include: { avatar: true },
        });
        // 4. Sort users by depth (asc), then createdAt (desc)
        users.sort((a, b) => {
          const depthA = descendantDepthMap.get(a.referenceId) ?? 99;
          const depthB = descendantDepthMap.get(b.referenceId) ?? 99;
          if (depthA !== depthB) return depthA - depthB;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        // 5. Take top 10
        return users
          .slice(0, 10)
          .map((user) => UserReferenceResponse.fromUserEntity(user));
      }

      const users = await this.prisma.user.findMany({
        where: {
          AND: [
            {
              verificationDate: {
                not: null,
              },
            },
            {
              OR: [
                {
                  fullName: {
                    contains: searchQuery.trim(),
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  email: {
                    contains: searchQuery.trim(),
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  phoneNumber: {
                    contains: searchQuery.trim(),
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  referenceId: {
                    contains: searchQuery.trim(),
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            },
          ],
        },
        include: {
          avatar: true,
        },
        take: 10,
        orderBy: [{ fullName: 'asc' }, { verificationDate: 'desc' }],
      });

      return users.map((user) => UserReferenceResponse.fromUserEntity(user));
    } catch (error) {
      this.logger.error('Error searching verified users:', error);
      throw new InternalServerErrorException('Failed to search verified users');
    }
  }
}
