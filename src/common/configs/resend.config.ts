import { registerAs } from '@nestjs/config';
import { IsString } from 'class-validator';
import { AllConfigType } from './types/index.type';
import validateConfig from '../utils';

class EnvironmentVariablesValidator {
  @IsString()
  RESEND_API_KEY: string;
}

export default registerAs<AllConfigType['resend']>('resend', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    resendApiKey: process.env.RESEND_API_KEY,
  };
});
