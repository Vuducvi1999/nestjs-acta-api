import { registerAs } from '@nestjs/config';
import { IsOptional, IsString } from 'class-validator';
import { AllConfigType } from './types/index.type';
import validateConfig from '../utils';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  REDIS_URL: string;
}

export default registerAs<AllConfigType['redis']>('redis', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    redisUrl: process.env.REDIS_URL,
  };
});
