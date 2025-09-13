export interface DatabaseConfig {
  databaseUrl?: string;
  directUrl?: string;

  // Connection pool settings
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}
