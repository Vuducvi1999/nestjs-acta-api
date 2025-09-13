import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import validateConfig from '../utils';
import { AllConfigType } from './types/index.type';

class EnvironmentVariablesValidator {
  @IsString()
  KIOTVIET_API_URL: string;

  @IsString()
  KIOTVIET_CLIENT_ID: string;

  @IsString()
  KIOTVIET_CLIENT_SECRET: string;

  @IsString()
  KIOTVIET_RETAILER_NAME: string;

  @IsOptional()
  @IsString()
  KIOTVIET_WEBHOOK_SECRET?: string;
}

export default registerAs<AllConfigType['kiotviet']>('kiotviet', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  if (
    !process.env.KIOTVIET_API_URL ||
    !process.env.KIOTVIET_CLIENT_ID ||
    !process.env.KIOTVIET_CLIENT_SECRET ||
    !process.env.KIOTVIET_RETAILER_NAME
  ) {
    throw new Error(
      'KIOTVIET_API_URL, KIOTVIET_CLIENT_ID, KIOTVIET_CLIENT_SECRET, and KIOTVIET_RETAILER_NAME must be set in environment variables',
    );
  }

  return {
    apiUrl: process.env.KIOTVIET_API_URL,
    clientId: process.env.KIOTVIET_CLIENT_ID,
    clientSecret: process.env.KIOTVIET_CLIENT_SECRET,
    retailerName: process.env.KIOTVIET_RETAILER_NAME,
    webhookSecret: process.env.KIOTVIET_WEBHOOK_SECRET,
  };
});
