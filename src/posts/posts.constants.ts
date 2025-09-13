export const POST_CONSTANTS = {
  CACHE_TTL: 10 * 1000, // 10 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
} as const;

export const POST_SORT_MODES = {
  LATEST: 'latest',
  ALL: 'all',
  MOST_REACTED: 'most-reacted',
  MOST_COMMENTED: 'most-commented',
} as const;

export const WEBSOCKET_EVENTS = {
  // User events
  KYC_SUBMITTED: 'kycSubmitted',
  KYC_STATUS_UPDATE: 'kycStatusUpdate',
  KYC_ADMIN_ACTION: 'kycAdminAction',
  // Notification events
  NEW_DIRECT_REFERRAL: 'newDirectReferral',
  NEW_INDIRECT_REFERRAL: 'newIndirectReferral',
  NEW_DIRECT_REFERRAL_VERIFIED: 'newDirectReferralVerified',
  POST_LIKED: 'postLiked',
  POST_APPROVED: 'postApproved',
  // Post events
  CREATE_POST: 'createPost',
  UPDATE_POST: 'updatePost',
  PUBLISH_POST: 'publishPost',
  UNPUBLISH_POST: 'unpublishPost',
  REJECT_POST: 'rejectPost',
  DELETE_POST: 'deletePost',
  NEW_POST: 'newPost',
  POST_UPDATED: 'postUpdated',
  POST_PUBLISHED: 'postPublished',
  POST_UNPUBLISHED: 'postUnpublished',
  POST_REJECTED: 'postRejected',
  POST_DELETED: 'postDeleted',

  // Reaction events
  USER_REACT: 'userReact',
  USER_UNREACT: 'userUnreact',
  REACTION_ADDED: 'reactionAdded',
  REACTION_UPDATED: 'reactionUpdated',
  REACTION_REMOVED: 'reactionRemoved',

  // Comment events
  ADD_COMMENT: 'addComment',
  DELETE_COMMENT: 'deleteComment',
  EDIT_COMMENT: 'editComment',
  LIKE_COMMENT: 'likeComment',
  UNLIKE_COMMENT: 'unlikeComment',
  COMMENT_ADDED: 'commentAdded',
  COMMENT_DELETED: 'commentDeleted',
  COMMENT_UPDATED: 'commentUpdated',
  COMMENT_LIKED: 'commentLiked',
  COMMENT_UNLIKED: 'commentUnliked',
  POST_COMMENTED: 'postCommented',
  // Comment reaction events
  COMMENT_REACTION_ADDED: 'commentReactionAdded',
  COMMENT_REACTION_UPDATED: 'commentReactionUpdated',
  COMMENT_REACTION_REMOVED: 'commentReactionRemoved',
  COMMENT_REACTIONS_UPDATED: 'commentReactionsUpdated',
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
