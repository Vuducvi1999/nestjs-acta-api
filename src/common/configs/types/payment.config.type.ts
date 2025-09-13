export type PaymentConfigType = {
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  vnpay: {
    tmnCode: string;
    hashSecret: string;
    returnUrl: string;
    ipnUrl: string;
    apiUrl: string;
  };

  cron?: {
    everyMinutes?: number; // Default: 5 minutes
    batchSize?: number; // Default: 100
  };
  webhook?: {
    secret?: string; // Webhook signature secret
  };
};
