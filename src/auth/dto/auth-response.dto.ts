import { Gender, Role, UserStatus } from '@prisma/client';
import { UserProfileResponseDto } from '../../users/dto/user-profile-response.dto';

export class AuthUserResponseDto {
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

  verficationDate?: Date;
  isActive: boolean;
  status: UserStatus;
  rejectedReason?: string;

  bio?: string;
  website?: string;

  referrer?: AuthUserResponseDto;

  config?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  constructor(partial: Partial<AuthUserResponseDto>) {
    Object.assign(this, partial);
  }

  static fromPrisma(user: any): AuthUserResponseDto {
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
      verficationDate: user.verificationDate,
      isActive: user.isActive,
      status: user.status,
      rejectedReason: user.rejectedReason,
      bio: user.bio,
      website: user.website,
      referrer: user.referrer
        ? AuthUserResponseDto.fromPrisma(user.referrer)
        : undefined,
      config: user.userConfig?.config,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}

// New LoginResponseDto to match frontend LoginResponse interface
export class LoginResponseDto {
  success: boolean;
  message?: string;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: UserProfileResponseDto;

  constructor(partial: Partial<LoginResponseDto>) {
    Object.assign(this, partial);
  }

  // Static method to create success response
  static success(
    accessToken: string,
    refreshToken: string,
    user: UserProfileResponseDto,
  ): LoginResponseDto {
    return new LoginResponseDto({
      success: true,
      accessToken,
      refreshToken,
      user,
    });
  }

  // Static method to create error response
  static error(message: string, error?: string): LoginResponseDto {
    return new LoginResponseDto({
      success: false,
      message,
      error: error || message,
    });
  }
}
