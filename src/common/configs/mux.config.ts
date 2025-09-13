import { registerAs } from '@nestjs/config';
import { IsString } from 'class-validator';
import validateConfig from '../utils';
import { AllConfigType } from './types/index.type';

class EnvironmentVariablesValidator {
  @IsString()
  MUX_TOKEN_ID: string;

  @IsString()
  MUX_TOKEN_SECRET: string;
}

export default registerAs<AllConfigType['mux']>('mux', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error(
      'MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set in environment variables',
    );
  }

  return {
    muxTokenId: process.env.MUX_TOKEN_ID,
    muxTokenSecret: process.env.MUX_TOKEN_SECRET,
  };
});
