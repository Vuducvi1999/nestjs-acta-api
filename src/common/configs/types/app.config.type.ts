export interface AppConfig {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  fallbackLanguage: string;
  headerLanguage: string;
  jwtSecretKey?: string;
  jwtRefreshSecretKey?: string;
}
