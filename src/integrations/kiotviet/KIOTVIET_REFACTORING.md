# KiotViet Service Refactoring

## 📋 Overview

This document outlines the refactoring of the KiotViet integration service from a single monolithic service into multiple specialized services for better maintainability, separation of concerns, and code organization.

## 🎯 Objectives Achieved

### ✅ **Service Separation**

- **Split monolithic service** into specialized services by domain
- **Improved maintainability** with focused responsibilities
- **Better code organization** and readability
- **Easier testing** with isolated service units

### ✅ **Code Quality Improvements**

- **Consistent error handling** across all services
- **Centralized authentication** logic
- **Reusable base service** with common functionality
- **Proper dependency injection** and service composition

### ✅ **Enhanced Features**

- **Comprehensive caching** strategy for each service
- **Health check** functionality for all services
- **Cache management** utilities
- **Better logging** and error tracking

## 🏗️ Architecture

### **File Structure**

```
src/integrations/kiotviet/services/
├── kiot-viet.auth.service.ts      # Authentication & configuration
├── kiot-viet.base.service.ts      # Base service with common functionality
├── kiot-viet.product.service.ts   # Product-related operations
├── kiot-viet.category.service.ts  # Category-related operations
├── kiot-viet.customer.service.ts  # Customer-related operations
├── kiot-viet.order.service.ts     # Order-related operations
├── kiot-viet.main.service.ts      # Main orchestrator service
└── index.ts                       # Service exports
```

### **Service Responsibilities**

#### **1. KiotVietAuthService**

- **Authentication**: Token management and refresh
- **Configuration**: Environment-based configuration
- **Headers**: HTTP headers creation for API requests
- **Authorization**: User role validation

#### **2. KiotVietBaseService**

- **Common HTTP methods**: GET, POST, PUT, DELETE with caching
- **Error handling**: Consistent error handling across services
- **Cache utilities**: Cache key generation and management
- **Logging**: Centralized logging functionality

#### **3. KiotVietProductService**

- **Product listing**: Get all products with caching
- **Product details**: Get product by ID
- **Product search**: Search products with query parameters
- **Cache management**: Product-specific cache operations

#### **4. KiotVietCategoryService**

- **Category listing**: Get all categories
- **Category details**: Get category by ID
- **Category CRUD**: Create, update, delete categories
- **Cache management**: Category-specific cache operations

#### **5. KiotVietCustomerService**

- **Customer listing**: Get all customers
- **Customer details**: Get customer by code
- **Customer CRUD**: Create, update, delete customers
- **Customer groups**: Get customer group information
- **Cache management**: Customer-specific cache operations

#### **6. KiotVietOrderService**

- **Order listing**: Get all orders
- **Order details**: Get order by code
- **Order CRUD**: Create, update, delete orders
- **Supplier orders**: Get supplier-specific orders
- **Cache management**: Order-specific cache operations

#### **7. KiotVietMainService**

- **Service orchestration**: Coordinates all other services
- **Unified interface**: Single entry point for all operations
- **Health checks**: Service health monitoring
- **Cache management**: Global cache operations

## 🔄 Service Operations

### **Product Operations**

```typescript
// Get all products
const products = await kiotVietMainService.getProducts(user);

// Get product by ID
const product = await kiotVietMainService.getProductById(user, productId);

// Search products
const searchResults = await kiotVietMainService.searchProducts(
  user,
  query,
  limit,
);
```

### **Category Operations**

```typescript
// Get all categories
const categories = await kiotVietMainService.getCategories(user);

// Get category detail
const category = await kiotVietMainService.getCategoryDetail(user, categoryId);

// Create category
const newCategory = await kiotVietMainService.createCategory(
  user,
  categoryData,
);

// Update category
const updatedCategory = await kiotVietMainService.updateCategory(
  user,
  categoryId,
  categoryData,
);

// Delete category
await kiotVietMainService.deleteCategory(user, categoryId);
```

### **Customer Operations**

```typescript
// Get all customers
const customers = await kiotVietMainService.getCustomers(user);

// Get customer by code
const customer = await kiotVietMainService.getCustomerByCode(
  user,
  customerCode,
);

// Create customer
const newCustomer = await kiotVietMainService.createCustomer(
  user,
  customerData,
);

// Update customer
const updatedCustomer = await kiotVietMainService.updateCustomer(
  user,
  customerId,
  customerData,
);

// Delete customer
await kiotVietMainService.deleteCustomer(user, customerId);

// Get customer groups
const groups = await kiotVietMainService.getCustomerGroups(user);
```

### **Order Operations**

```typescript
// Get all orders
const orders = await kiotVietMainService.getOrders(user);

// Get order by code
const order = await kiotVietMainService.getOrderByCode(user, orderCode);

// Create order
const newOrder = await kiotVietMainService.createOrder(user, orderData);

// Update order
const updatedOrder = await kiotVietMainService.updateOrder(
  user,
  orderId,
  orderData,
);

// Delete order
await kiotVietMainService.deleteOrder(user, orderId);

// Get supplier orders
const supplierOrders = await kiotVietMainService.getSupplierOrders(user);
```

## 🗄️ Caching Strategy

### **Cache Keys Pattern**

```
kiotviet:{service}:{userId}                    # List operations
kiotviet:{service}:{id}:{userId}              # Detail operations
kiotviet:{service}:search:{query}:{userId}    # Search operations
kiotviet:accessToken                          # Authentication token
```

### **Cache TTL**

- **Default TTL**: 300 seconds (5 minutes)
- **Authentication token**: Uses token expiration time
- **Configurable**: Can be adjusted per service

### **Cache Management**

```typescript
// Clear specific service cache
await kiotVietMainService.clearProductCache(userId);
await kiotVietMainService.clearCategoryCache(userId);
await kiotVietMainService.clearCustomerCache(userId);
await kiotVietMainService.clearOrderCache(userId);

// Clear all cache
await kiotVietMainService.clearAllCache(userId);
```

## 🏥 Health Checks

### **Health Check Response**

```typescript
{
  status: 'healthy' | 'unhealthy',
  services: {
    auth: boolean,
    products: boolean,
    categories: boolean,
    customers: boolean,
    orders: boolean
  }
}
```

### **Usage**

```typescript
const healthStatus = await kiotVietMainService.healthCheck(user);
```

## 🔧 Error Handling

### **Consistent Error Pattern**

All services use the same error handling pattern:

- **Logging**: Detailed error logging with context
- **User-friendly messages**: Clear error messages for users
- **BadRequestException**: Consistent exception type
- **Stack traces**: Full error stack traces for debugging

### **Error Response Format**

```typescript
{
  message: string,
  error: string,
  statusCode: number
}
```

## 📊 Benefits

### **1. Maintainability**

- **Single responsibility**: Each service has a focused purpose
- **Easy to modify**: Changes are isolated to specific services
- **Clear dependencies**: Explicit service dependencies
- **Reduced complexity**: Smaller, more manageable code units

### **2. Testability**

- **Isolated testing**: Each service can be tested independently
- **Mock dependencies**: Easy to mock service dependencies
- **Unit tests**: Focused unit tests for each service
- **Integration tests**: Test service interactions

### **3. Performance**

- **Optimized caching**: Service-specific caching strategies
- **Reduced memory usage**: Smaller service instances
- **Better resource management**: Efficient resource allocation
- **Parallel processing**: Services can run in parallel

### **4. Developer Experience**

- **Clear file organization**: Easy to find specific functionality
- **Consistent patterns**: Uniform coding patterns across services
- **Better IDE support**: Improved autocomplete and navigation
- **Documentation**: Clear service responsibilities

## 🔄 Migration Notes

### **Updated Files**

- `kiotviet.module.ts`: Updated providers and imports
- `services/index.ts`: Updated exports
- `kiotviet.service.ts`: Replaced with specialized services

### **New Files**

- `kiot-viet.auth.service.ts`: Authentication service
- `kiot-viet.base.service.ts`: Base service with common functionality
- `kiot-viet.product.service.ts`: Product operations
- `kiot-viet.category.service.ts`: Category operations
- `kiot-viet.customer.service.ts`: Customer operations
- `kiot-viet.order.service.ts`: Order operations
- `kiot-viet.main.service.ts`: Main orchestrator service

### **Breaking Changes**

- **Service injection**: Controllers need to inject `KiotVietMainService` instead of `KiotVietService`
- **Method signatures**: Some method signatures may have changed
- **Error handling**: Error responses may have different formats

## 🚀 Future Enhancements

### **Potential Improvements**

1. **Service-specific DTOs**: Create DTOs for each service
2. **Validation pipes**: Add validation for service inputs
3. **Rate limiting**: Implement rate limiting per service
4. **Metrics collection**: Add performance metrics
5. **Circuit breaker**: Implement circuit breaker pattern
6. **Retry logic**: Add retry mechanisms for failed requests

### **Configuration Options**

1. **Service-specific configs**: Different configurations per service
2. **Environment-based settings**: Different settings for dev/staging/prod
3. **Feature flags**: Enable/disable specific service features
4. **Custom cache strategies**: Configurable caching per service

## 📝 Conclusion

The KiotViet service refactoring represents a significant improvement in code organization, maintainability, and scalability. The new architecture provides:

- **Better separation of concerns** with specialized services
- **Improved maintainability** through focused responsibilities
- **Enhanced testability** with isolated service units
- **Better performance** through optimized caching strategies
- **Developer-friendly** codebase with clear patterns

This refactoring serves as a template for future service improvements across the application.
