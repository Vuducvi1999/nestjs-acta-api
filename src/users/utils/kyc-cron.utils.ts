import { UserStatus } from '@prisma/client';
import { USER_CONFIG_KEYS } from '../models/user-config.constant';
import {
  TIME_CONSTANTS,
  THRESHOLD_CONSTANTS,
  EMAIL_MESSAGES,
  REVIEWER_NAMES,
} from '../constants/cron.constants';
import {
  UserWithConfig,
  EmailContent,
  KYCChangingEmailContent,
} from '../types/kyc-cron.types';

/**
 * Filter users who want to receive email notifications
 */
export function filterUsersForEmailNotification<
  T extends { userConfig?: { config: any } | null },
>(users: T[]): T[] {
  return users.filter((user) => {
    if (!user.userConfig) return true;
    const config = user.userConfig.config as Record<string, any>;
    return config?.[USER_CONFIG_KEYS.EMAIL_SUBSCRIPTION] !== false;
  });
}

/**
 * Calculate days since last update
 */
export function calculateDaysSinceUpdate(updatedAt: Date): number {
  return Math.floor(
    (Date.now() - updatedAt.getTime()) / TIME_CONSTANTS.ONE_DAY,
  );
}

/**
 * Generate KYC reminder email content based on days since update
 */
export function generateKYCEmailContent(user: UserWithConfig): EmailContent {
  const daysSinceUpdate = calculateDaysSinceUpdate(user.updatedAt);
  const updateUrl = `${process.env.FRONTEND_URL}/kyc`;

  let reason: string;
  if (daysSinceUpdate < THRESHOLD_CONSTANTS.WARNING_KYC_DAYS) {
    reason = EMAIL_MESSAGES.KYC_REMINDER.RECENT;
  } else if (daysSinceUpdate < THRESHOLD_CONSTANTS.URGENT_KYC_DAYS) {
    reason = EMAIL_MESSAGES.KYC_REMINDER.WARNING(daysSinceUpdate);
  } else {
    reason = EMAIL_MESSAGES.KYC_REMINDER.URGENT(daysSinceUpdate);
  }

  return { reason, updateUrl };
}

/**
 * Generate KYC changing email content based on days since update
 */
export function generateKYCChangingEmailContent(
  user: UserWithConfig,
): KYCChangingEmailContent {
  const daysSinceUpdate = calculateDaysSinceUpdate(user.updatedAt);
  const updateUrl = `${process.env.FRONTEND_URL}/kyc`;

  let message: string;
  let reviewerName: string;

  if (daysSinceUpdate < THRESHOLD_CONSTANTS.WARNING_KYC_DAYS) {
    message = EMAIL_MESSAGES.KYC_CHANGING.RECENT;
    reviewerName = REVIEWER_NAMES.DEFAULT;
  } else if (daysSinceUpdate < THRESHOLD_CONSTANTS.URGENT_KYC_DAYS) {
    message = EMAIL_MESSAGES.KYC_CHANGING.WARNING(daysSinceUpdate);
    reviewerName = REVIEWER_NAMES.DEFAULT;
  } else {
    message = EMAIL_MESSAGES.KYC_CHANGING.URGENT(daysSinceUpdate);
    reviewerName = REVIEWER_NAMES.URGENT;
  }

  return { message, reviewerName, updateUrl };
}

/**
 * Calculate KYC urgency statistics
 */
export function calculateKYCUrgencyStats(users: Array<{ updatedAt: Date }>) {
  const now = Date.now();
  let urgent = 0;
  let warning = 0;
  let recent = 0;

  users.forEach((user) => {
    const daysSince = Math.floor(
      (now - user.updatedAt.getTime()) / TIME_CONSTANTS.ONE_DAY,
    );

    if (daysSince >= THRESHOLD_CONSTANTS.URGENT_KYC_DAYS) {
      urgent++;
    } else if (daysSince >= THRESHOLD_CONSTANTS.WARNING_KYC_DAYS) {
      warning++;
    } else {
      recent++;
    }
  });

  return { total: users.length, urgent, warning, recent };
}

/**
 * Group KYC users by status
 */
export function groupUsersByKYCStatus<T extends { status: UserStatus }>(
  users: T[],
): { pending: T[]; changing: T[] } {
  const pending = users.filter(
    (user) => user.status === UserStatus.pending_kyc,
  );
  const changing = users.filter(
    (user) => user.status === UserStatus.kyc_changing,
  );
  return { pending, changing };
}

/**
 * Create delay utility
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format success rate percentage
 */
export function formatSuccessRate(total: number, success: number): string {
  return total > 0 ? ((success / total) * 100).toFixed(2) : '0';
}

/**
 * Calculate days until birthday from current date
 * @param dob Date of birth
 * @returns Number of days until next birthday
 */
export function calculateDaysUntilBirthday(dob: Date): number {
  const today = new Date();
  const currentYear = today.getFullYear();

  // Create birthday for current year
  const birthdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());

  // If birthday already passed this year, calculate for next year
  if (birthdayThisYear < today) {
    const birthdayNextYear = new Date(
      currentYear + 1,
      dob.getMonth(),
      dob.getDate(),
    );
    return Math.ceil(
      (birthdayNextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  return Math.ceil(
    (birthdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Check if user has upcoming birthday within specified days
 * @param dob Date of birth
 * @param daysThreshold Number of days to check ahead
 * @returns True if birthday is within threshold
 */
export function hasUpcomingBirthday(dob: Date, daysThreshold: number): boolean {
  const daysUntilBirthday = calculateDaysUntilBirthday(dob);
  return daysUntilBirthday <= daysThreshold && daysUntilBirthday > 0;
}

/**
 * Filter users with upcoming birthdays
 * @param users Array of users with birthday info
 * @param daysThreshold Number of days to check ahead
 * @returns Users with upcoming birthdays
 */
export function filterUsersWithUpcomingBirthdays<
  T extends { dob: Date | null },
>(users: T[], daysThreshold: number): T[] {
  return users.filter((user) => {
    if (!user.dob) return false;
    return hasUpcomingBirthday(user.dob, daysThreshold);
  });
}
