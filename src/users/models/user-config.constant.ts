export const USER_CONFIG_KEYS = {
  // public/private - Chế độ hiển thị hồ sơ (đối với người ngoài cây giới thiệu sẽ không hiển thị nếu là private)
  PROFILE_PRIVACY: 'profile_privacy',
  // true/false - Chế độ nhận email từ hệ thống
  EMAIL_SUBSCRIPTION: 'email_subscription',
  // public/private - Chế độ hiển thị thông tin cá nhân (đối với người ngoài cây giới thiệu sẽ không hiển thị nếu là private)
  INFORMATION_PUBLICITY: 'information_publicity',
  NOTIFICATION_SETTINGS: 'notification_settings',
  SECURITY_SETTINGS: 'security_settings',
  PAYMENT_METHODS: 'payment_methods',
  SHIPPING_PREFERENCES: 'shipping_preferences',
  LANGUAGE: 'language',
  // Avatar post settings - Cài đặt tự động tạo bài viết khi đổi ảnh đại diện
  AVATAR_POSTS: 'avatar_posts',
} as const;
