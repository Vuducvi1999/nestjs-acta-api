export const PAYMENT_WEBSOCKET_EVENTS = {
  // Payment status updates
  PAYMENT_CREATED: 'payment_created',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_EXPIRED: 'payment_expired',
  PAYMENT_CANCELLED: 'payment_cancelled',

  // Order status updates
  ORDER_PAYMENT_RECEIVED: 'order_payment_received',
  ORDER_STATUS_UPDATED: 'order_status_updated',
  ORDER_INVENTORY_COMMITTED: 'order_inventory_committed',

  // Real-time monitoring
  PAYMENT_STATUS_UPDATE: 'payment_status_update',
  PAYMENT_EXPIRY_WARNING: 'payment_expiry_warning',
  PAYMENT_VERIFICATION_ATTEMPT: 'payment_verification_attempt',

  // Webhook notifications
  WEBHOOK_RECEIVED: 'webhook_received',
  WEBHOOK_PROCESSED: 'webhook_processed',
  WEBHOOK_ERROR: 'webhook_error',

  // User actions
  USER_PAYMENT_ATTEMPT: 'user_payment_attempt',
  USER_PAYMENT_CONFIRMATION: 'user_payment_confirmation',
  USER_PAYMENT_CANCELLATION: 'user_payment_cancellation',

  // System events
  PAYMENT_SYSTEM_ERROR: 'payment_system_error',
  PAYMENT_TIMEOUT: 'payment_timeout',
  PAYMENT_RECONCILIATION: 'payment_reconciliation',
} as const;

export const PAYMENT_ROOMS = {
  USER_PAYMENTS: (userId: string) => `user_payments_${userId}`,
  ORDER_PAYMENTS: (orderId: string) => `order_payments_${orderId}`,
  PAYMENT_MONITORING: (paymentId: string) => `payment_monitoring_${paymentId}`,
  ADMIN_PAYMENTS: 'admin_payments',
} as const;
