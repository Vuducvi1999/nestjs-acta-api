# KiotViet Field Mappings Guide - 2-Way Synchronization

## Tổng quan (Overview)

Hệ thống đồng bộ dữ liệu 2 chiều giữa ACTA và KiotViet sử dụng **field mappings** để định nghĩa cách các trường dữ liệu được ánh xạ giữa hai hệ thống. Tài liệu này giải thích chi tiết cách thức hoạt động của field mappings và cách quản lý chúng.

## Kiến trúc Field Mappings (Architecture)

### 1. Cấu trúc dữ liệu (Data Structure)

```json
{
  "fieldMappings": {
    "product": {
      "id": "id",
      "code": "code",
      "name": "name",
      "fullName": "fullName",
      "description": "description",
      "categoryId": "categoryId",
      "categoryName": "categoryName",
      "tradeMarkId": "tradeMarkId",
      "tradeMarkName": "tradeMarkName",
      "basePrice": "basePrice",
      "taxType": "taxType",
      "taxRate": "taxRate",
      "taxname": "taxname",
      "weight": "weight",
      "unit": "unit",
      "conversionValue": "conversionValue",
      "isLotSerialControl": "isLotSerialControl",
      "isBatchExpireControl": "isBatchExpireControl",
      "isActive": "isActive",
      "allowsSale": "allowsSale",
      "hasVariants": "hasVariants",
      "type": "type",
      "images": "images",
      "orderTemplate": "orderTemplate",
      "retailerId": "retailerId",
      "createdDate": "createdDate",
      "modifiedDate": "modifiedDate"
    },
    "customer": {
      "name": "customerName",
      "code": "customerCode",
      "phone": "contactNumber",
      "email": "email",
      "address": "address"
    },
    "order": {
      "code": "orderCode",
      "customer": "customerCode",
      "items": "orderDetails",
      "total": "total",
      "status": "status"
    }
  }
}
```

### 2. Nguyên tắc ánh xạ (Mapping Principles)

- **Key**: Tên trường trong hệ thống ACTA
- **Value**: Tên trường tương ứng trong KiotViet API
- **Flexible Mapping**: Có thể tùy chỉnh ánh xạ theo yêu cầu kinh doanh
- **Null Safety**: Các trường không có trong mapping sẽ sử dụng giá trị mặc định

## Đồng bộ 2 chiều (2-Way Synchronization)

### 1. KiotViet → ACTA (Import from KiotViet)

#### Luồng dữ liệu:

```
KiotViet API → Field Mapping → ACTA Database → UI Update
```

#### Ví dụ sản phẩm:

```javascript
// Dữ liệu từ KiotViet
const kiotvietProduct = {
  id: 12345,
  code: 'SP001',
  name: 'Áo sơ mi nam',
  fullName: 'Áo sơ mi nam cao cấp',
  basePrice: 150000,
  categoryId: 1,
  categoryName: 'Thời trang nam',
  isActive: true,
};

// Sau khi áp dụng field mapping
const actaProduct = {
  id: 'acta_12345', // Generated ACTA ID
  sku: 'SP001', // Mapped from kiotviet.code
  name: 'Áo sơ mi nam', // Mapped from kiotviet.name
  description: 'Áo sơ mi nam cao cấp', // Mapped from kiotviet.fullName
  price: 150000, // Mapped from kiotviet.basePrice
  categoryId: 'category_1', // Mapped and created if needed
  isActive: true, // Mapped from kiotviet.isActive
};
```

### 2. ACTA → KiotViet (Export to KiotViet)

#### Luồng dữ liệu:

```
ACTA Database → Reverse Field Mapping → KiotViet API → Sync Confirmation
```

#### Ví dụ sản phẩm:

```javascript
// Dữ liệu từ ACTA
const actaProduct = {
  id: 'acta_001',
  sku: 'SP002',
  name: 'Quần jean nữ',
  description: 'Quần jean nữ thời trang',
  price: 200000,
  categoryId: 'category_2',
  isActive: true,
};

// Sau khi áp dụng reverse field mapping
const kiotvietProduct = {
  code: 'SP002', // Mapped from acta.sku
  name: 'Quần jean nữ', // Mapped from acta.name
  fullName: 'Quần jean nữ thời trang', // Mapped from acta.description
  basePrice: 200000, // Mapped from acta.price
  categoryId: 2, // Mapped from category lookup
  isActive: true, // Mapped from acta.isActive
};
```

## Quản lý Field Mappings

### 1. Xem cấu hình hiện tại

```http
GET /api/integrations/kiotviet/config
Authorization: Bearer {token}
```

### 2. Cập nhật field mappings

```http
PUT /api/integrations/kiotviet/config/field-mappings
Authorization: Bearer {token}
Content-Type: application/json

{
  "product": {
    "name": "product_name",
    "description": "product_description",
    "basePrice": "selling_price"
  },
  "customer": {
    "name": "customer_full_name",
    "phone": "mobile_number"
  }
}
```

### 3. Frontend API Usage

```typescript
import { createKiotVietConfigApis } from '@/app/api/integrations/kiotviet/kiotviet-config-api';

const apis = createKiotVietConfigApis({
  accessToken: 'your-token',
  user: currentUser,
});

// Cập nhật field mappings
const updatedConfig = await apis.post.updateFieldMappings({
  product: {
    name: 'custom_product_name',
    basePrice: 'custom_price_field',
  },
});
```

## Các trường hợp sử dụng (Use Cases)

### 1. Tùy chỉnh tên trường KiotViet

**Scenario**: KiotViet của bạn sử dụng tên trường custom khác với mặc định.

```json
{
  "product": {
    "name": "ten_san_pham",
    "basePrice": "gia_ban",
    "description": "mo_ta_chi_tiet"
  }
}
```

### 2. Bỏ qua một số trường

**Scenario**: Không muốn đồng bộ một số trường nhất định.

```json
{
  "product": {
    "weight": null,
    "dimensions": null,
    "taxRate": null
  }
}
```

### 3. Ánh xạ phức tạp

**Scenario**: Kết hợp nhiều trường KiotViet thành một trường ACTA.

```javascript
// Trong mapping service
const combineDescription = (kiotvietProduct) => {
  return `${kiotvietProduct.description} - ${kiotvietProduct.specifications}`;
};
```

## Validation và Error Handling

### 1. Validation Rules

- **Required Fields**: Một số trường bắt buộc phải có mapping
- **Data Type**: Kiểm tra kiểu dữ liệu sau khi mapping
- **Business Logic**: Áp dụng các quy tắc kinh doanh

```typescript
const validateMapping = (mappedData: any) => {
  if (!mappedData.sku) {
    throw new Error('SKU là trường bắt buộc');
  }

  if (mappedData.price < 0) {
    throw new Error('Giá sản phẩm không thể âm');
  }
};
```

### 2. Error Recovery

```typescript
const mapProductWithFallback = (kiotvietProduct: any, fieldMappings: any) => {
  try {
    return mapProduct(kiotvietProduct, fieldMappings);
  } catch (error) {
    // Log error và sử dụng mapping mặc định
    logger.error('Mapping error, using default:', error);
    return mapProduct(kiotvietProduct, defaultFieldMappings);
  }
};
```

## Performance và Best Practices

### 1. Caching Strategy

```typescript
class FieldMappingCache {
  private cache = new Map<string, any>();

  async getFieldMappings(configId: string) {
    if (this.cache.has(configId)) {
      return this.cache.get(configId);
    }

    const mappings = await this.loadFromDatabase(configId);
    this.cache.set(configId, mappings);
    return mappings;
  }

  invalidate(configId: string) {
    this.cache.delete(configId);
  }
}
```

### 2. Batch Processing

```typescript
const batchMapProducts = async (
  products: KiotVietProduct[],
  batchSize = 100,
) => {
  const results = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const mappedBatch = await Promise.all(
      batch.map((product) => mapKiotVietProductToProduct(product)),
    );
    results.push(...mappedBatch);
  }

  return results;
};
```

### 3. Memory Management

```typescript
// Giải phóng bộ nhớ sau khi xử lý
const processLargeDataSet = async (data: any[]) => {
  const results = [];

  for (const item of data) {
    const processed = await processItem(item);
    results.push(processed);

    // Giải phóng reference để GC có thể thu hồi
    item = null;
  }

  return results;
};
```

## Monitoring và Logging

### 1. Sync Logs

```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY,
  direction VARCHAR(20), -- 'KIOTVIET_TO_ACTA' | 'ACTA_TO_KIOTVIET'
  entity_type VARCHAR(20), -- 'PRODUCT' | 'CUSTOMER' | 'ORDER'
  status VARCHAR(20), -- 'SUCCESS' | 'FAILED' | 'PARTIAL'
  details JSONB,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Logging Strategy

```typescript
class SyncLogger {
  async logSyncStart(direction: string, entityType: string) {
    return await this.prisma.syncLog.create({
      data: {
        direction,
        entityType,
        status: 'PENDING',
        startTime: new Date(),
        details: { message: 'Sync started' },
      },
    });
  }

  async logSyncEnd(syncId: string, status: string, details: any) {
    return await this.prisma.syncLog.update({
      where: { id: syncId },
      data: {
        status,
        endTime: new Date(),
        details,
      },
    });
  }
}
```

## Troubleshooting

### 1. Common Issues

#### Field Mapping Not Working

```bash
# Kiểm tra cấu hình
curl -X GET "http://localhost:3000/api/integrations/kiotviet/config" \
  -H "Authorization: Bearer {token}"

# Kiểm tra logs
tail -f logs/sync.log | grep "field_mapping"
```

#### Data Type Mismatch

```typescript
// Thêm type conversion trong mapping
const mapPrice = (value: any): number => {
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }
  return Number(value) || 0;
};
```

#### Missing Required Fields

```typescript
const validateRequiredFields = (data: any, requiredFields: string[]) => {
  const missing = requiredFields.filter((field) => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};
```

### 2. Debug Mode

```typescript
// Bật debug mode
const DEBUG_MAPPING = process.env.DEBUG_MAPPING === 'true';

const mapWithDebug = (data: any, mappings: any) => {
  if (DEBUG_MAPPING) {
    console.log('Input data:', data);
    console.log('Mappings:', mappings);
  }

  const result = applyMappings(data, mappings);

  if (DEBUG_MAPPING) {
    console.log('Output data:', result);
  }

  return result;
};
```

## Security Considerations

### 1. Access Control

- Chỉ admin mới có thể cập nhật field mappings
- Audit log cho mọi thay đổi
- Rate limiting cho API endpoints

### 2. Data Validation

```typescript
const sanitizeFieldMapping = (mapping: any) => {
  // Chỉ cho phép các ký tự an toàn trong field names
  const allowedPattern = /^[a-zA-Z0-9_.-]+$/;

  Object.keys(mapping).forEach((key) => {
    if (!allowedPattern.test(mapping[key])) {
      throw new Error(`Invalid field name: ${mapping[key]}`);
    }
  });

  return mapping;
};
```

## Future Enhancements

### 1. Advanced Mapping Features

- **Conditional Mapping**: Ánh xạ dựa trên điều kiện
- **Formula Mapping**: Sử dụng công thức tính toán
- **Multi-source Mapping**: Kết hợp nhiều nguồn dữ liệu

### 2. AI-Powered Mapping

```typescript
// Tự động phát hiện và đề xuất field mappings
const suggestMappings = async (kiotvietSchema: any, actaSchema: any) => {
  const suggestions = await aiService.analyzeSchemaSimilarity(
    kiotvietSchema,
    actaSchema,
  );

  return suggestions.map((s) => ({
    confidence: s.confidence,
    mapping: s.suggestedMapping,
    reason: s.explanation,
  }));
};
```

### 3. Real-time Sync

```typescript
// WebSocket-based real-time synchronization
const setupRealtimeSync = () => {
  const ws = new WebSocket('wss://api.kiotviet.vn/realtime');

  ws.on('product_updated', async (data) => {
    const mappedProduct = await mapKiotVietProductToProduct(data);
    await syncToACTA(mappedProduct);
  });
};
```

---

## Kết luận

Field mappings là thành phần quan trọng nhất trong hệ thống đồng bộ 2 chiều giữa ACTA và KiotViet. Việc hiểu rõ và quản lý đúng cách field mappings sẽ đảm bảo:

1. **Tính chính xác** của dữ liệu đồng bộ
2. **Tính linh hoạt** trong việc tùy chỉnh
3. **Hiệu suất** cao trong xử lý
4. **Dễ dàng bảo trì** và mở rộng

Hãy tham khảo tài liệu này khi triển khai và vận hành hệ thống đồng bộ dữ liệu.
