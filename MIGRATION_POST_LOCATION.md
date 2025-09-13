# PostLocation Model Migration Guide

## Overview

The PostLocation model has been simplified to only include essential fields:

- **Before**: `id`, `name`, `address`, `latitude`, `longitude`, `postId`, `post`, `createdAt`, `updatedAt`
- **After**: `id`, `address`, `postId`, `post`, `createdAt`, `updatedAt`

## Prerequisites

### 1. Install axios (required for @nestjs/axios)

```bash
cd acta-api
yarn add axios
# or
npm install axios
```

**Why this is needed**: `@nestjs/axios` requires `axios` as a peer dependency.

## Changes Made

### 1. Database Schema (`prisma/schema/social.prisma`)

- Removed `name` field
- Removed `latitude` field
- Removed `longitude` field
- Removed related indexes

### 2. DTOs Updated

- `CreatePostLocationDto`: Only `address` field
- `PostLocationResponseDto`: Only `address` field
- `UpdatePostDto`: Inherits from `CreatePostDto`

### 3. Services Updated

- `posts.service.ts`: Location creation/update only uses `address`
- `posts.helpers.ts`: Location search uses `address` instead of `name`
- `avatar-post.service.ts`: Location creation only uses `address`

### 4. Frontend Types (`acta-web/types/social.type.ts`)

- `PostLocation` interface already updated correctly

## Migration Steps

### Step 1: Run Database Migration

```bash
cd acta-api
npm run migrate:simplify-post-location
```

### Step 2: Regenerate Prisma Client

```bash
npx prisma generate
```

### Step 3: Restart Backend Service

```bash
npm run dev
```

## What This Means

1. **Location Search**: Now searches by `address` content instead of `name`
2. **Location Creation**: Only requires `address` field
3. **API Responses**: Location objects only contain `address`
4. **Frontend**: Location picker now works with address-based suggestions

## Testing

After migration, test:

1. Creating posts with location
2. Searching posts by location
3. Location picker modal functionality
4. API responses for posts with location

## Rollback (if needed)

If you need to rollback, you can restore the old schema and run:

```sql
ALTER TABLE "post_locations"
ADD COLUMN "name" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

CREATE INDEX "post_locations_name_idx" ON "post_locations"("name");
CREATE INDEX "post_locations_latitude_longitude_idx" ON "post_locations"("latitude", "longitude");
```
