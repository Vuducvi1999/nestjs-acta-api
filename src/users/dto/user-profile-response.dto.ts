import { Gender, Role, UserStatus } from '@prisma/client';

export class AddressResponseInProfile {
  id: string;
  name: string;
  type: string;
  fullName: string;
  phone: string;
  street: string;
  ward?: string;
  district?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfileResponseDto {
  id: string;
  referenceId: string;

  avatarUrl?: string;
  coverUrl?: string;

  email: string;
  fullName: string;
  phoneNumber: string;
  dob: Date;
  gender: Gender;

  country: string;

  bio?: string;
  website?: string;

  totalReferrals: number;
  totalFollowers: number;
  totalFollowing: number;
  totalPosts: number;

  verificationDate: Date;
  isActive: boolean;
  status: UserStatus;
  role: Role;
  rejectedReason?: string;
  config?: Record<string, any>;

  // Add referrer information
  referrer?: {
    id: string;
    fullName: string;
    referenceId: string;
    avatarUrl?: string;
  };

  // Add addresses information
  addresses?: AddressResponseInProfile[];
  defaultAddressId?: string;

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  constructor(partial: Partial<UserProfileResponseDto>) {
    Object.assign(this, partial);
  }

  static fromUserEntity(
    user: any,
    isInformationPrivate?: boolean,
  ): UserProfileResponseDto {
    return {
      id: user.id,
      referenceId: user.referenceId,

      avatarUrl: user.avatar?.fileUrl,
      coverUrl: user.cover?.fileUrl,

      email: isInformationPrivate ? undefined : user.email,
      fullName: user.fullName,
      phoneNumber: isInformationPrivate ? undefined : user.phoneNumber,
      dob: isInformationPrivate ? undefined : user.dob,
      gender: isInformationPrivate ? undefined : user.gender,

      country: isInformationPrivate ? undefined : user.country,

      bio: isInformationPrivate ? undefined : user.bio,
      website: isInformationPrivate ? undefined : user.website,

      totalReferrals: user._count.referrals,
      totalFollowers: user._count.followers,
      totalFollowing: user._count.following,
      totalPosts: user._count.posts,

      verificationDate: user.verificationDate,
      isActive: user.isActive,
      status: user.status,
      rejectedReason: user.rejectedReason,
      role: user.role,

      config: user.userConfig?.config,

      // Add referrer information
      referrer: user.referrer
        ? {
            id: user.referrer.id,
            fullName: user.referrer.fullName,
            referenceId: user.referrer.referenceId,
            avatarUrl: user.referrer.avatar?.fileUrl,
          }
        : undefined,

      // Add addresses information
      addresses: user.addresses
        ? user.addresses.map((address: any) => ({
            id: address.id,
            name: address.name,
            type: address.type,
            fullName: address.fullName,
            phone: address.phone,
            street: address.street,
            ward: address.ward,
            district: address.district,
            city: address.city,
            state: address.state,
            country: address.country,
            postalCode: address.postalCode,
            placeId: address.placeId,
            latitude: address.latitude,
            longitude: address.longitude,
            formattedAddress: address.formattedAddress,
            isDefault: address.isDefault,
            createdAt: address.createdAt,
            updatedAt: address.updatedAt,
          }))
        : undefined,
      defaultAddressId: user.addresses
        ? user.addresses.find((addr: any) => addr.isDefault)?.id || null
        : null,

      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }
}

export class UserProfileMediaResponseDto {}

export enum MediaType {
  POST = 'post',
  NEWS_EVENT = 'news-event',
  DOCUMENTS = 'documents',
}

export class UserProfileMediaReactionResponseDto {}
