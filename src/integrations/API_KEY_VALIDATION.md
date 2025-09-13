# API Key Validation for KiotViet Integration

This document describes the API key validation system implemented for the KiotViet integration.

## Overview

The API key validation system provides secure access to KiotViet integration endpoints by validating API keys against the database and checking their active status.

## Components

### 1. ApiKeyValidationService

Located at `src/integrations/api-key-validation.service.ts`

This service provides methods to:

- Validate KiotViet API keys
- Get configuration by API key
- Check if API keys exist
- Get all active API keys

#### Key Methods:

```typescript
// Validate if an API key is valid and active
async validateKiotVietApiKey(apiKey: string): Promise<boolean>

// Get configuration for an API key
async getKiotVietConfigByApiKey(apiKey: string)

// Validate and get configuration in one call
async validateAndGetKiotVietConfig(apiKey: string): Promise<{ isValid: boolean; config?: any }>

// Check if API key exists (regardless of active status)
async apiKeyExists(apiKey: string): Promise<boolean>

// Get all active API keys
async getActiveKiotVietApiKeys(): Promise<string[]>
```

### 2. KiotVietApiKey Decorator

Located at `src/common/decorators/integrations.decorator.ts`

This decorator can be used in controllers to automatically validate API keys from request headers.

#### Usage:

```typescript
@Post('protected-endpoint')
async protectedEndpoint(@KiotVietApiKey() apiKeyData: any) {
  // apiKeyData contains:
  // - apiKey: string
  // - config: KiotVietConfig (without systemConfig relation)
  //   - id: string
  //   - apiKey: string
  //   - isActive: boolean
  //   - fieldMappings: Json
  //   - syncSettings: Json
  //   - createdAt: DateTime
  //   - updatedAt: DateTime
}
```

### 3. Database Schema

The API key validation uses the following Prisma models:

```prisma
model SystemConfig {
  id String @id @default(uuid())
  kiotvietConfigId String?
  kiotvietConfig   KiotVietConfig?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("system_configs")
}

model KiotVietConfig {
  id String @id @default(uuid())
  apiKey   String  @unique
  isActive Boolean @default(false)
  fieldMappings Json?
  syncSettings  Json?
  systemConfigId String       @unique
  systemConfig   SystemConfig @relation(fields: [systemConfigId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("kiotviet_configs")
}
```

## API Endpoints

### 1. Validate API Key

**POST** `/integrations/kiotviet/validate-api-key`

**Request Body:**

```json
{
  "apiKey": "your-api-key-here"
}
```

**Response:**

```json
{
  "isValid": true,
  "hasConfig": true,
  "message": "API key is valid"
}
```

### 2. Get API Key Information

**POST** `/integrations/kiotviet/api-key-info`

**Request Body:**

```json
{
  "apiKey": "your-api-key-here"
}
```

**Response:**

```json
{
  "exists": true,
  "isValid": true,
  "hasConfig": true,
  "isActive": true,
  "message": "API key is valid and active"
}
```

### 3. Test with Decorator

**POST** `/integrations/kiotviet/test-with-api-key`

**Headers:**

```
x-kiotviet-api-key: your-api-key-here
```

**Response:**

```json
{
  "message": "API key validation successful",
  "apiKey": "your-api-key-here",
  "configId": "config-uuid",
  "isActive": true,
  "fieldMappings": {},
  "syncSettings": {}
}
```

## Security Features

1. **Database Validation**: API keys are validated against the database
2. **Active Status Check**: Only active API keys are considered valid
3. **Unique Keys**: Each API key is unique in the database
4. **Error Handling**: Comprehensive error handling with logging
5. **Decorator Pattern**: Easy to use in controllers with automatic validation

## Error Responses

### Missing API Key

```json
{
  "statusCode": 401,
  "message": "API key is required"
}
```

### Invalid API Key

```json
{
  "statusCode": 401,
  "message": "Invalid or inactive API key"
}
```

### Configuration Not Found

```json
{
  "statusCode": 401,
  "message": "API key configuration not found"
}
```

## Usage Examples

### In a Controller

```typescript
@Controller('integrations/kiotviet')
export class KiotVietController {
  constructor(
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  @Post('sync-products')
  async syncProducts(@KiotVietApiKey() apiKeyData: any) {
    // apiKeyData.config contains the configuration (without systemConfig)
    // Proceed with sync operation
    return { message: 'Sync started' };
  }

  @Post('manual-validation')
  async manualValidation(@Body() body: { apiKey: string }) {
    const isValid = await this.apiKeyValidationService.validateKiotVietApiKey(
      body.apiKey,
    );
    return { isValid };
  }
}
```

### Direct Service Usage

```typescript
@Injectable()
export class SomeService {
  constructor(
    private readonly apiKeyValidationService: ApiKeyValidationService,
  ) {}

  async someMethod(apiKey: string) {
    const { isValid, config } =
      await this.apiKeyValidationService.validateAndGetKiotVietConfig(apiKey);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Use config for further operations (config excludes systemConfig)
    return this.processWithConfig(config);
  }
}
```

## Best Practices

1. **Always validate API keys** before processing sensitive operations
2. **Use the decorator** for automatic validation in controllers
3. **Handle errors gracefully** with appropriate HTTP status codes
4. **Log validation failures** for security monitoring
5. **Keep API keys secure** and never expose them in logs or responses
6. **Use HTTPS** for all API key transmissions
7. **Implement rate limiting** for API key validation endpoints
