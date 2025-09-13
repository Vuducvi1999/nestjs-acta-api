import { IsNumber, IsString } from 'class-validator';
import { PaymentConfigType } from './types/payment.config.type';
import { registerAs } from '@nestjs/config';
import validateConfig from '../utils';

class EnvironmentVariablesValidator {
  @IsString()
  STRIPE_SECRET_KEY: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET: string;

  @IsString()
  VNP_TMN_CODE: string;

  @IsString()
  VNP_HASH_SECRET: string;

  @IsString()
  VNP_RETURN_URL: string;

  @IsString()
  VNP_IPN_URL: string;

  @IsString()
  VNP_API_URL: string;

  @IsString()
  DEFAULT_CURRENCY: string;
}

export default registerAs<PaymentConfigType>('payment', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    vnpay: {
      tmnCode: process.env.VNP_TMN_CODE || '',
      hashSecret: process.env.VNP_HASH_SECRET || '',
      returnUrl: process.env.VNP_RETURN_URL || '',
      ipnUrl: process.env.VNP_IPN_URL || '',
      apiUrl: process.env.VNP_API_URL || '',
    },

    defaultCurrency: process.env.DEFAULT_CURRENCY || 'VND',
  };
});
