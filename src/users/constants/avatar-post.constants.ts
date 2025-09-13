// Avatar post creation constants
export const AVATAR_POST_CONSTANTS = {
  // Enable/disable automatic post creation
  ENABLED: true,

  // Delay before creating post (in milliseconds)
  POST_CREATION_DELAY: 1000,

  // Post visibility settings
  AUTO_PUBLISH: true, // Auto-publish for verified users

  // Content limits
  MAX_CONTENT_LENGTH: 500,
} as const;

// Avatar post message templates
export const AVATAR_POST_MESSAGES = {
  DEFAULT: 'Tôi vừa cập nhật ảnh đại diện mới! 📸✨',
  WITH_EMOJI: [
    'Ảnh đại diện mới của tôi đây! 😊✨',
    'Vừa thay đổi ảnh đại diện! 📸 Các bạn thấy thế nào?',
    'Ảnh mới, tâm trạng mới! 🌟',
    'Cập nhật ảnh đại diện xong rồi! 💫',
    'Ảnh đại diện mới, phiên bản mới của tôi! 🎉',
  ],
  SEASONAL: {
    SPRING: 'Mùa xuân mới, ảnh đại diện mới! 🌸',
    SUMMER: 'Hè rồi, đổi ảnh đại diện thôi! ☀️',
    AUTUMN: 'Thu về, ảnh mới cũng về! 🍂',
    WINTER: 'Mùa đông ấm áp với ảnh đại diện mới! ❄️',
  },
  TIME_BASED: {
    MORNING: 'Chào buổi sáng với ảnh đại diện mới! 🌅',
    AFTERNOON: 'Buổi chiều cập nhật ảnh mới! ☀️',
    EVENING: 'Buổi tối thay đổi ảnh đại diện! 🌆',
    NIGHT: 'Đêm muộn vẫn không quên cập nhật ảnh! 🌙',
  },
} as const;

// Avatar post configuration
export const AVATAR_POST_CONFIG = {
  // User roles that get auto-published posts
  AUTO_PUBLISH_ROLES: ['admin', 'verified'],

  // Minimum time between avatar updates to create new posts (in minutes)
  MIN_UPDATE_INTERVAL: 30,

  // Maximum number of avatar posts per day per user
  MAX_POSTS_PER_DAY: 5,

  // Post tags for avatar updates
  DEFAULT_TAGS: ['avatar_update', 'profile_update'],
} as const;

// Avatar post types
export enum AvatarPostType {
  SIMPLE = 'simple',
  WITH_COMPARISON = 'with_comparison', // Show old vs new avatar
  CELEBRATION = 'celebration', // Special occasions
  SEASONAL = 'seasonal', // Season-based messages
  TIME_BASED = 'time_based', // Time of day based messages
}

// Avatar post creation reasons
export enum AvatarUpdateReason {
  USER_INITIATED = 'user_initiated',
  PROFILE_COMPLETION = 'profile_completion',
  SEASONAL_UPDATE = 'seasonal_update',
  SPECIAL_EVENT = 'special_event',
}
