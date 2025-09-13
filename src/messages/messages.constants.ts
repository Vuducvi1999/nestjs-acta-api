export const CONVERSATION_CONSTANTS = {
  CACHE_TTL: 1000 * 10, // 10 seconds in milliseconds
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
} as const;

export const WEBSOCKET_EVENTS = {
  // User events
  USER_CONNECTED: 'userConnected', // Client to server
  USER_DISCONNECTED: 'userDisconnected', // Client to server
  USER_TYPING: 'userTyping', // Client to server
  USER_STOP_TYPING: 'userStopTyping', // Client to server

  // Messages events
  SEND_MESSAGE: 'sendMessage', // Client to server
  MESSAGE_SENT: 'messageSent', // Server to clients
  MESSAGE_DELIVERED: 'messageDelivered', // Server to sender
  MESSAGE_READ: 'messageRead', // Client to server to others
  NEW_MESSAGE: 'newMessage', // Server to clients

  // Conversation events
  CONVERSATION_CREATED: 'conversationCreated', // Server to clients
  CONVERSATION_UPDATED: 'conversationUpdated', // Server to clients
  CONVERSATION_DELETED: 'conversationDeleted', // Server to clients
  JOIN_CONVERSATION: 'joinConversation', // Client to server
  LEAVE_CONVERSATION: 'leaveConversation', // Client to server

  // Notifications
  NOTIFICATION_NEW_MESSAGE: 'notificationNewMessage',
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
