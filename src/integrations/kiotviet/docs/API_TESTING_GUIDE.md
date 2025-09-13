# KiotViet Integration API Testing Guide

## Overview

This guide provides comprehensive testing instructions for the KiotViet product synchronization API endpoints. The implementation includes two main controllers for syncing and monitoring.

## API Endpoints

### 🔄 Product Synchronization Controller

**Base URL**: `/integrations/kiotviet/sync`

#### 1. Start Product Sync

```http
POST /integrations/kiotviet/sync/products
Authorization: Bearer <jwt_token>
```

**Description**: Starts a full product synchronization from KiotViet to ACTA.

**Response**:

```json
{
  "success": true,
  "message": "Đồng bộ sản phẩm từ KiotViet thành công",
  "data": {
    "syncLogId": "clx1234567890abcdef",
    "summary": {
      "totalRecords": 150,
      "successCount": 145,
      "failedCount": 5,
      "duration": 45230
    },
    "statistics": {
      "categories": {
        "adds": 12,
        "updates": 0,
        "skips": 3,
        "conflicts": 0,
        "errors": 0
      },
      "businesses": {
        "adds": 8,
        "updates": 0,
        "skips": 2,
        "conflicts": 0,
        "errors": 0
      },
      "warehouses": {
        "adds": 5,
        "updates": 0,
        "skips": 1,
        "conflicts": 0,
        "errors": 0
      },
      "users": {
        "adds": 8,
        "updates": 0,
        "skips": 2,
        "conflicts": 0,
        "errors": 0
      },
      "products": {
        "adds": 145,
        "updates": 0,
        "skips": 0,
        "conflicts": 3,
        "errors": 2
      }
    },
    "errors": ["Product SP001: Missing category information"]
  }
}
```

#### 2. Get Sync Status

```http
GET /integrations/kiotviet/sync/status/{syncLogId}
Authorization: Bearer <jwt_token>
```

**Parameters**:

- `syncLogId`: ID of the sync log to check

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "clx1234567890abcdef",
    "direction": "KIOTVIET_TO_ACTA",
    "entityType": "PRODUCT",
    "status": "SUCCESS",
    "details": {
      /* detailed sync information */
    },
    "startTime": "2025-01-16T10:00:00Z",
    "endTime": "2025-01-16T10:01:30Z",
    "duration": 90000,
    "createdAt": "2025-01-16T10:00:00Z"
  }
}
```

#### 3. Get Latest Sync Status

```http
GET /integrations/kiotviet/sync/latest
Authorization: Bearer <jwt_token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "clx1234567890abcdef",
    "status": "SUCCESS",
    "duration": 90000
    /* ... other fields */
  }
}
```

#### 4. Check if Sync is Running

```http
GET /integrations/kiotviet/sync/is-running
Authorization: Bearer <jwt_token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "latestSyncId": "clx1234567890abcdef",
    "startTime": "2025-01-16T10:00:00Z",
    "runningDuration": null
  }
}
```

#### 5. Get Sync History

```http
GET /integrations/kiotviet/sync/history?page=1&limit=10
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 50)

**Response**:

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "clx1234567890abcdef",
        "status": "SUCCESS",
        "details": {
          /* sync details */
        },
        "startTime": "2025-01-16T10:00:00Z",
        "endTime": "2025-01-16T10:01:30Z",
        "duration": 90000,
        "createdAt": "2025-01-16T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### 6. Get Sync Statistics

```http
GET /integrations/kiotviet/sync/stats
Authorization: Bearer <jwt_token>
```

**Response**:

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalSyncs": 25,
      "successfulSyncs": 22,
      "failedSyncs": 2,
      "partialSyncs": 1,
      "successRate": 88.0
    },
    "latest": {
      "status": "SUCCESS",
      "startTime": "2025-01-16T10:00:00Z",
      "endTime": "2025-01-16T10:01:30Z",
      "duration": 90000,
      "details": {
        /* latest sync details */
      }
    }
  }
}
```

#### 7. Health Check

```http
GET /integrations/kiotviet/sync/health
```

**Response**:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-16T10:30:00Z",
    "database": "connected",
    "lastSyncStatus": "SUCCESS",
    "lastSyncTime": "2025-01-16T10:00:00Z"
  }
}
```

### 📊 Sync Logs Controller

**Base URL**: `/integrations/kiotviet/logs`

#### 1. Get All Sync Logs

```http
GET /integrations/kiotviet/logs?entityType=PRODUCT&direction=KIOTVIET_TO_ACTA&status=SUCCESS&page=1&limit=20
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

- `entityType`: Filter by entity type (PRODUCT, etc.)
- `direction`: Filter by sync direction (KIOTVIET_TO_ACTA, etc.)
- `status`: Filter by status (SUCCESS, FAILED, PENDING, PARTIAL)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `startDate`: Filter logs from this date (ISO string)
- `endDate`: Filter logs until this date (ISO string)

#### 2. Get Sync Log by ID

```http
GET /integrations/kiotviet/logs/{id}
Authorization: Bearer <jwt_token>
```

#### 3. Get Statistics by Entity Type

```http
GET /integrations/kiotviet/logs/stats/PRODUCT?direction=KIOTVIET_TO_ACTA&days=30
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

- `direction`: Filter by sync direction (optional)
- `days`: Number of days to include (default: 30, max: 365)

#### 4. Get Failed Sync Logs

```http
GET /integrations/kiotviet/logs/failures/list?page=1&limit=20
Authorization: Bearer <jwt_token>
```

#### 5. Clean Up Old Logs

```http
DELETE /integrations/kiotviet/logs/cleanup?days=90
Authorization: Bearer <jwt_token>
```

**Query Parameters**:

- `days`: Keep logs newer than this many days (default: 90, min: 30)

#### 6. Get Performance Metrics

```http
GET /integrations/kiotviet/logs/performance/metrics?days=7
Authorization: Bearer <jwt_token>
```

#### 7. Create Test Sync Log

```http
POST /integrations/kiotviet/logs/test
Authorization: Bearer <jwt_token>
```

**Description**: Creates a test sync log for testing purposes.

## Testing Scenarios

### 🧪 Basic Testing Flow

#### 1. Health Check

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/health"
```

#### 2. Check Current Status

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/latest" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Start Sync

```bash
curl -X POST "http://localhost:3000/integrations/kiotviet/sync/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### 4. Monitor Progress

```bash
# Check if sync is running
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/is-running" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check specific sync status (replace with actual syncLogId)
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/status/SYNC_LOG_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 5. Review Results

```bash
# Get sync history
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/history?page=1&limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get statistics
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 🔍 Advanced Testing

#### 1. Filter Logs by Date Range

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/logs?startDate=2025-01-01&endDate=2025-01-31&status=SUCCESS" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 2. Get Performance Metrics

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/logs/performance/metrics?days=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Check Failed Syncs

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/logs/failures/list" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Create Test Data

```bash
curl -X POST "http://localhost:3000/integrations/kiotviet/logs/test" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Scenarios Testing

### 1. Unauthorized Access

```bash
curl -X POST "http://localhost:3000/integrations/kiotviet/sync/products"
# Expected: 401 Unauthorized
```

### 2. Invalid Sync Log ID

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/sync/status/invalid-id" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Expected: 404 Not Found
```

### 3. Invalid Query Parameters

```bash
curl -X GET "http://localhost:3000/integrations/kiotviet/logs?page=0&limit=1000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Should handle gracefully with default values
```

## Testing with Postman

### Collection Setup

1. **Create Environment Variables**:

   - `base_url`: `http://localhost:3000`
   - `jwt_token`: Your authentication token

2. **Create Pre-request Script** (for authentication):
   ```javascript
   pm.request.headers.add({
     key: 'Authorization',
     value: 'Bearer ' + pm.environment.get('jwt_token'),
   });
   ```

### Test Collection Structure

```
📁 KiotViet Integration Tests
├── 📁 Health & Status
│   ├── Health Check
│   ├── Latest Sync Status
│   └── Is Sync Running
├── 📁 Product Sync
│   ├── Start Product Sync
│   ├── Get Sync Status
│   └── Get Sync History
├── 📁 Logs Management
│   ├── Get All Logs
│   ├── Get Failed Logs
│   ├── Performance Metrics
│   └── Clean Up Logs
└── 📁 Test Utilities
    └── Create Test Log
```

### Test Scripts

#### Sync Status Test

```javascript
pm.test('Status code is 200', function () {
  pm.response.to.have.status(200);
});

pm.test('Response has success field', function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('success');
  pm.expect(jsonData.success).to.eql(true);
});

pm.test('Response has data field', function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('data');
});
```

#### Sync History Test

```javascript
pm.test('Pagination is correct', function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.data).to.have.property('pagination');

  var pagination = jsonData.data.pagination;
  pm.expect(pagination).to.have.property('page');
  pm.expect(pagination).to.have.property('limit');
  pm.expect(pagination).to.have.property('total');
  pm.expect(pagination).to.have.property('totalPages');
});
```

## Performance Testing

### Load Testing with Artillery

1. **Create `artillery-config.yml`**:

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
  defaults:
    headers:
      Authorization: 'Bearer YOUR_JWT_TOKEN'

scenarios:
  - name: 'Health Check Load Test'
    requests:
      - get:
          url: '/integrations/kiotviet/sync/health'

  - name: 'Status Check Load Test'
    requests:
      - get:
          url: '/integrations/kiotviet/sync/latest'

  - name: 'Logs Query Load Test'
    requests:
      - get:
          url: '/integrations/kiotviet/logs?page={{ $randomInt(1, 10) }}&limit=20'
```

2. **Run Load Test**:

```bash
npm install -g artillery
artillery run artillery-config.yml
```

### Stress Testing Scenarios

1. **Concurrent Sync Attempts**: Test multiple sync requests simultaneously
2. **High-frequency Status Checks**: Rapid polling of sync status
3. **Large Page Size Requests**: Testing with maximum page sizes
4. **Date Range Queries**: Testing with large date ranges

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Sync Success Rate**: Should be > 95%
2. **Average Sync Duration**: Monitor for performance degradation
3. **Failed Sync Count**: Alert if > 5% of syncs fail
4. **Database Connection**: Monitor health endpoint
5. **Memory Usage**: During large sync operations

### Sample Monitoring Script

```bash
#!/bin/bash
# Simple monitoring script

API_BASE="http://localhost:3000/integrations/kiotviet/sync"
JWT_TOKEN="YOUR_JWT_TOKEN"

# Check health
HEALTH=$(curl -s "$API_BASE/health" | jq -r '.data.status')
if [ "$HEALTH" != "healthy" ]; then
    echo "ALERT: Service is not healthy"
fi

# Check if sync is stuck
LATEST=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" "$API_BASE/latest")
IS_RUNNING=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" "$API_BASE/is-running" | jq -r '.data.isRunning')
RUNNING_DURATION=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" "$API_BASE/is-running" | jq -r '.data.runningDuration')

if [ "$IS_RUNNING" = "true" ] && [ "$RUNNING_DURATION" -gt 600000 ]; then
    echo "ALERT: Sync has been running for more than 10 minutes"
fi
```

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check JWT token validity
2. **500 Internal Server Error**: Check database connection and KiotViet API
3. **Timeout Errors**: Monitor sync duration and adjust timeout settings
4. **Memory Issues**: Monitor during large product imports

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
npm start
```

### Database Queries for Manual Testing

```sql
-- Check sync logs
SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 10;

-- Check sync statistics
SELECT
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration
FROM sync_logs
WHERE entity_type = 'PRODUCT'
GROUP BY status;

-- Check for stuck syncs
SELECT * FROM sync_logs
WHERE status = 'PENDING'
AND created_at < NOW() - INTERVAL '1 hour';
```

---

**Note**: Replace `YOUR_JWT_TOKEN` with actual JWT tokens obtained through the authentication system. Ensure the integration service dependencies (KiotViet API, database) are properly configured before testing.

_Last updated: 2025_
_Version: 1.0_
