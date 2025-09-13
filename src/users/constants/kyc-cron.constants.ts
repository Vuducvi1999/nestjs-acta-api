// Time constants (in milliseconds)
export const TIME_CONSTANTS = {
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

// Delay constants (in milliseconds)
export const DELAY_CONSTANTS = {
  EMAIL_DELAY: 100,
  NOTIFICATION_DELAY: 50,
} as const;

// Threshold constants (in days)
export const THRESHOLD_CONSTANTS = {
  KYC_REMINDER_DAYS: 2,
  KYC_CHANGING_REMINDER_DAYS: 7,
  STALE_KYC_DAYS: 7,
  URGENT_KYC_DAYS: 7,
  WARNING_KYC_DAYS: 3,
} as const;

// Email message constants
export const EMAIL_MESSAGES = {
  KYC_REMINDER: {
    RECENT:
      'Vui lòng hoàn thành thông tin KYC để có thể sử dụng đầy đủ tính năng của hệ thống.',
    WARNING: (days: number) =>
      `Tài khoản của bạn đã ở trạng thái chờ KYC ${days} ngày. Vui lòng cập nhật thông tin để tiếp tục sử dụng dịch vụ.`,
    URGENT: (days: number) =>
      `Tài khoản của bạn đã chưa hoàn thành KYC hơn ${days} ngày. Vui lòng cập nhật ngay để tránh bị hạn chế tài khoản.`,
  },
  KYC_CHANGING: {
    RECENT:
      'Chúng tôi đã yêu cầu bạn cập nhật thông tin KYC. Vui lòng hoàn tất việc cập nhật để tài khoản của bạn được xử lý nhanh chóng.',
    WARNING: (days: number) =>
      `Tài khoản của bạn đã ở trạng thái cần sửa đổi KYC ${days} ngày. Vui lòng cập nhật thông tin sớm nhất để tránh gián đoạn dịch vụ.`,
    URGENT: (days: number) =>
      `Tài khoản của bạn đã cần sửa đổi KYC hơn ${days} ngày. Đây là nhắc nhở cuối cùng - vui lòng cập nhật ngay để tránh bị tạm khóa tài khoản.`,
  },
} as const;

// Notification message constants
export const NOTIFICATION_MESSAGES = {
  REFERRAL_KYC: {
    BOTH: (pending: number, changing: number) =>
      `Bạn có ${pending} cấp dưới trực tiếp chờ KYC và ${changing} cấp dưới trực tiếp cần sửa KYC. Vui lòng nhắc nhở họ để đảm bảo tài khoản hoạt động bình thường.`,
    PENDING_ONLY: (count: number) =>
      `Bạn có ${count} cấp dưới trực tiếp chờ hoàn thành KYC. Vui lòng nhắc nhở họ để đảm bảo tài khoản hoạt động bình thường.`,
    CHANGING_ONLY: (count: number) =>
      `Bạn có ${count} cấp dưới trực tiếp cần sửa KYC. Vui lòng nhắc nhở họ để đảm bảo tài khoản hoạt động bình thường.`,
  },
} as const;

// Reviewer names
export const REVIEWER_NAMES = {
  DEFAULT: 'Đội ngũ ACTA',
  URGENT: 'Bộ phận Kiểm duyệt ACTA',
} as const;
