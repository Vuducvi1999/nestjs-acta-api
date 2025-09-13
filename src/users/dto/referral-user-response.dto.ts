import { Gender, Role, UserStatus } from '@prisma/client';

export class ReferralUserResponseDto {
  id: string;

  role: Role;
  referenceId: string;

  avatarUrl?: string;
  coverUrl?: string;

  email: string;
  fullName: string;
  phoneNumber: string;
  dob: string;
  gender: Gender;
  country: string;

  verificationDate: Date;
  isActive: boolean;
  status: UserStatus;
  rejectedReason?: string;

  referrals: ReferralUserResponseDto[];
  referralsCount: number;

  depth?: number; // ✅ NEW: indicates the referral depth from ancestor
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(partial: Partial<ReferralUserResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(
    user: any,
    allowedReferenceIds?: Set<string>,
    depth?: number, // optional depth injection
  ): ReferralUserResponseDto {
    return {
      id: user.id,
      role: user.role,
      referenceId: user.referenceId,
      avatarUrl: user.avatar?.fileUrl,
      coverUrl: user.cover?.fileUrl,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      dob: user.dob?.toISOString(),
      gender: user.gender,
      country: user.country,
      verificationDate: user.verificationDate,
      isActive: user.isActive,
      status: user.status,
      rejectedReason: user.rejectedReason,
      referrals:
        user.referrals && Array.isArray(user.referrals)
          ? user.referrals
              .filter(
                (r) =>
                  !allowedReferenceIds ||
                  allowedReferenceIds.has(r.referenceId),
              )
              .map((r) =>
                ReferralUserResponseDto.fromPrisma(r, allowedReferenceIds),
              )
          : [],
      referralsCount: user._count?.referrals || 0,
      depth, // ✅ Include depth in output
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}

// Add pagination response DTO
export class PaginatedReferralUserResponseDto {
  data: ReferralUserResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;

  constructor(
    data: ReferralUserResponseDto[],
    total: number,
    page: number,
    limit: number,
  ) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }

  static fromPaginatedResult(params: {
    data: ReferralUserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedReferralUserResponseDto {
    return new PaginatedReferralUserResponseDto(
      params.data,
      params.total,
      params.page,
      params.limit,
    );
  }
}
