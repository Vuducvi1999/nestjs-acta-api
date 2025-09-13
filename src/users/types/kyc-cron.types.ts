import { UserStatus, KycStatus } from '@prisma/client';

// User types
export interface UserWithConfig {
  id: string;
  fullName: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  userConfig?: {
    id: string;
    config: any;
  } | null;
}

export interface UserWithKYC {
  id: string;
  fullName: string;
  email: string;
  referenceId: string;
  status: UserStatus;
}

export interface UserWithKYCIssue {
  id: string;
  fullName: string;
  email: string;
  referenceId: string;
  status: UserStatus;
}

export interface AncestorUser {
  id: string;
  fullName: string;
  email: string;
  referenceId: string;
}

// KYC types
export interface SubmittedKYC {
  id: string;
  status: KycStatus;
  createdAt: Date;
  user: UserWithKYC;
}

// Referral types
export interface ReferralClosure {
  ancestorId: string;
  descendantId: string;
  depth: number;
}

export interface ReferralNotification {
  descendantId: string;
  depth: number;
  userWithIssue: UserWithKYCIssue;
}

// Stats types
export interface KYCStats {
  total: number;
  success: number;
  failed: number;
  successRate: string;
}

export interface KYCUrgencyStats {
  total: number;
  urgent: number;
  warning: number;
  recent: number;
}

export interface ReferralKYCStats {
  usersWithKYCIssues: number;
  pendingKYCUsers: number;
  kycChangingUsers: number;
  totalDirectReferralRelationships: number;
  uniqueAncestorsToNotify: number;
}

// Email content types
export interface EmailContent {
  reason: string;
  updateUrl: string;
}

export interface KYCChangingEmailContent {
  message: string;
  reviewerName: string;
  updateUrl: string;
}

// Birthday notification types
export interface UserWithBirthday {
  id: string;
  fullName: string;
  email: string;
  referenceId: string;
  dob: Date;
  status: UserStatus;
}

export interface BirthdayNotification {
  userId: string;
  fullName: string;
  daysUntilBirthday: number;
  relationshipType: 'referrer' | 'direct_referral' | 'indirect_referral';
}

export interface BirthdayNotificationStats {
  totalUsersWithUpcomingBirthdays: number;
  totalNotificationsSent: number;
  notificationsByType: {
    referrer: number;
    directReferral: number;
    indirectReferral: number;
  };
  success: number;
  failed: number;
  successRate: string;
}
