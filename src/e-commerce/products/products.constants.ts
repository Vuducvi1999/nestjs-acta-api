export const PRODUCT_CONSTANTS = {
  CACHE_TTL: 10 * 1000, // 10 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
} as const;

export const USER_SELECT_FIELDS = {
  id: true,
  fullName: true,
  status: true,
  avatar: {
    select: {
      fileUrl: true,
    },
  },
  referenceId: true,
  verificationDate: true,
  role: true,
} as const;

export const USER_SELECT_FIELDS_WITH_AUTH = {
  ...USER_SELECT_FIELDS,
  email: true,
  phoneNumber: true,
} as const;
