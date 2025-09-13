import { registerAs } from '@nestjs/config';

import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { DatabaseConfig } from './types/database.config.type';
import validateConfig from '../utils';

class EnvironmentVariablesValidator {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  DIRECT_URL: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  DATABASE_MAX_CONNECTIONS?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  DATABASE_CONNECTION_TIMEOUT?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60000)
  DATABASE_IDLE_TIMEOUT?: number;
}

export default registerAs<DatabaseConfig>('database', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,

    // Connection pool settings with defaults
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
    connectionTimeout: parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT || '30000',
    ),
    idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
  };
});
