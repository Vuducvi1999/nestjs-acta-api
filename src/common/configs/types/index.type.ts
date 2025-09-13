import { AppConfig } from './app.config.type';
import { DatabaseConfig } from './database.config.type';
import { KiotVietConfigType } from './kiotviet.config.type';
import { PaymentConfigType } from './payment.config.type';

export type AllConfigType = {
  app: AppConfig;
  database: DatabaseConfig;
  resend: {
    resendApiKey?: string;
  };
  mux: {
    muxTokenId?: string;
    muxTokenSecret?: string;
  };
  redis: {
    redisUrl?: string;
  };
  kiotviet: KiotVietConfigType;
  payment: PaymentConfigType;
};
