import { Gender, Role, UserStatus } from '@prisma/client';

// ! ONLY UNCHANGE DATA + TOKENSØ WILL COME HERE
export interface JwtPayload {
  id: string;
  email: string;
  phoneNumber: string;
  referenceId: string;
  accessToken?: string;
}

export interface AuthUser {
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

  // Add referrer information
  referrer?: {
    id: string;
    fullName: string;
    referenceId: string;
    avatarUrl?: string;
  };

  // Add addresses information
  addresses?: Array<{
    id: string;
    name: string;
    type: 'home' | 'work' | 'other';
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
    createdAt: string;
    updatedAt: string;
  }>;
  defaultAddressId?: string;
}