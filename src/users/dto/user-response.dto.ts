export class UserResponseDto {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  country: string;
  referenceId: string;
  gender: string;
  dob: Date;
  role: string;
  verificationDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  avatar?: {
    id: string;
    fileUrl: string;
  };
  referrer?: {
    id: string;
    fullName: string;
    referenceId: string;
    avatar?: {
      id: string;
      fileUrl: string;
    };
  };
  business?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo?: string;
    avatar?: string;
    website?: string;
    address?: string;
    type: string;
    verified: boolean;
    isActive: boolean;
    joinDate: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  static fromUser(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      country: user.country,
      referenceId: user.referenceId,
      gender: user.gender,
      dob: user.dob,
      role: user.role,
      verificationDate: user.verificationDate,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      avatar: user.avatar
        ? {
            id: user.avatar.id,
            fileUrl: user.avatar.fileUrl,
          }
        : undefined,
      referrer: user.referrer
        ? {
            id: user.referrer.id,
            fullName: user.referrer.fullName,
            referenceId: user.referrer.referenceId,
            avatar: user.referrer.avatar
              ? {
                  id: user.referrer.avatar.id,
                  fileUrl: user.referrer.avatar.fileUrl,
                }
              : undefined,
          }
        : undefined,
      business: user.business
        ? {
            id: user.business.id,
            name: user.business.name,
            slug: user.business.slug,
            description: user.business.description,
            logo: user.business.logo,
            avatar: user.business.avatar,
            website: user.business.website,
            address: user.business.address,
            type: user.business.type,
            verified: user.business.verified,
            isActive: user.business.isActive,
            joinDate: user.business.joinDate,
            createdAt: user.business.createdAt,
            updatedAt: user.business.updatedAt,
          }
        : undefined,
    };
  }
}

export class PaginatedUserResponseDto {
  data: UserResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;

  static fromPaginatedResult(result: {
    data: any[];
    total: number;
    page: number;
    limit: number;
  }): PaginatedUserResponseDto {
    const totalPages = Math.ceil(result.total / result.limit);

    return {
      data: result.data.map(UserResponseDto.fromUser),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages,
      hasNext: result.page < totalPages,
      hasPrev: result.page > 1,
    };
  }
}
