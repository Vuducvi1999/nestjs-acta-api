# KiotViet Integration

This module provides a seamless integration between KiotViet and ACTA E-Commerce, allowing businesses to sync their inventory management, customer data, orders, invoices, and other e-commerce data between the two systems.

## Features

- **Bidirectional Data Sync**: Keep data in sync between KiotViet and ACTA E-Commerce
- **Real-time Updates**: Receive webhook notifications when data changes in KiotViet
- **Flexible Scheduling**: Configure sync intervals based on your needs
- **Custom Field Mapping**: Map fields between systems for seamless data flow
- **Comprehensive Logging**: Track all sync activities for troubleshooting
- **System Registration**: Properly register with KiotViet API for compliance

## Setup Instructions

### 1. Register Your System with KiotViet

Before using the integration, you must register your system with KiotViet:

1. Contact KiotViet support at support@kiotviet.com to request API access
2. Provide your retailer name and system details to get registered
3. Receive your Client ID and Client Secret for API authentication
4. Set these in your environment variables (see below)

### 2. Configure Environment Variables

Add the following to your `.env` file:

```
# KiotViet Integration
KIOTVIET_API_URL=https://public.kiotapi.com
KIOTVIET_CLIENT_ID=your_client_id_here
KIOTVIET_CLIENT_SECRET=your_client_secret_here
KIOTVIET_RETAILER_NAME=your_retailer_name_here
KIOTVIET_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Setup Webhook in KiotViet

1. Log in to your KiotViet account
2. Go to Settings > API & Integrations > Webhooks
3. Create a new webhook with the URL: `{{KiotVietBaseURL}}/api/webhooks/kiotviet`
4. Select the events you want to receive (recommended: all product, customer, order, and invoice events)
5. Generate a webhook secret and copy it to your `KIOTVIET_WEBHOOK_SECRET` environment variable

### 4. Configure the Integration in ACTA E-Commerce

1. Log in to ACTA E-Commerce as an Administrator
2. Go to Settings > Integrations > KiotViet
3. Enter your KiotViet Client ID and Client Secret
4. Configure your Retailer Name
5. Configure field mappings between the systems
6. Set up sync settings (what to sync and how often)
7. Select default categories and settings for incoming products
8. Save your configuration

## Usage Guide

### Manual Sync

You can manually trigger a sync at any time:

1. Go to Settings > Integrations > KiotViet
2. Click "Sync Now" to start an immediate sync
3. View the sync logs to check progress

Alternatively, use the API endpoints:

- `POST /api/integrations/kiotviet/sync/all` - Sync all organizations
- `POST /api/integrations/kiotviet/sync/from-kiotviet/:organizationId` - Sync a specific organization

### Automatic Sync

The system offers three ways to keep data in sync automatically:

1. **Scheduled Sync**: By default, syncs run every 30 minutes for all active integrations
2. **Custom Schedules**: Each organization can set their own sync interval
3. **Real-time Webhooks**: Immediate updates when data changes in KiotViet

To configure automatic sync:

1. Go to Settings > Integrations > KiotViet > Sync Settings
2. Enable "Auto Sync"
3. Set your desired sync interval (in minutes)
4. Save your configuration

### Data Mapping

The integration maps the following data between systems:

| KiotViet              | ACTA E-Commerce       | Enhanced Sync                              |
| --------------------- | --------------------- | ------------------------------------------ |
| Products              | Products              | ✅ Full product details with relationships |
| Product Inventories   | Product Inventories   | ✅ Per-warehouse stock levels              |
| Product Attributes    | Product Attributes    | ✅ Custom specifications                   |
| Product Units         | Product Units         | ✅ Alternative measurement units           |
| Product Price Books   | Product Price Books   | ✅ Multiple pricing tiers                  |
| Product Formulas      | Product Formulas      | ✅ Bill of Materials                       |
| Product Serials       | Product Serials       | ✅ Individual product tracking             |
| Product Batch Expires | Product Batch Expires | ✅ Lot management                          |
| Product Warranties    | Product Warranties    | ✅ Warranty information                    |
| Product Shelves       | Product Shelves       | ✅ Physical location tracking              |
| Customers             | Customers             | Basic mapping                              |
| Orders                | Orders                | Basic mapping                              |
| Invoices              | Invoices              | Basic mapping                              |
| Categories            | Categories            | Basic mapping                              |
| Branches              | Warehouses            | ✅ Dynamic warehouse creation              |
| Users                 | Users                 | Basic mapping                              |
| Purchase Orders       | Purchase Orders       | Basic mapping                              |
| Returns               | Returns               | Basic mapping                              |
| Transfers             | Transfers             | Basic mapping                              |
| Cashflow              | Cashflow              | Basic mapping                              |
| Surchages             | Surchages             | Basic mapping                              |
| Bank Accounts         | Bank Accounts         | Basic mapping                              |

### Enhanced Product Synchronization

The product sync now includes comprehensive relationship mapping:

- **Individual Product Fetching**: Each product is fetched with complete details from KiotViet
- **Dynamic Warehouse Creation**: Warehouses are created automatically from branch information
- **Complete Relationship Sync**: All product relationships are synchronized
- **Smart Upsert Logic**: Existing data is updated, new data is created
- **Error Recovery**: Individual failures don't affect the entire sync

For detailed information, see [Enhanced Product Sync Documentation](./ENHANCED_PRODUCT_SYNC.md)

### Testing the Connection

To verify your integration is working correctly:

1. Go to Settings > Integrations > KiotViet
2. Click "Test Connection"
3. The system will attempt to connect to KiotViet API using your Client ID and Client Secret
4. Check the response to confirm success or troubleshoot issues

## Troubleshooting

### Common Issues

1. **Authentication Failures**

   - Verify your Client ID and Client Secret are correct
   - Check that your system is properly registered with KiotViet

2. **Webhook Issues**

   - Confirm your webhook secret matches in both systems
   - Ensure your server is accessible from the internet
   - Check webhook logs in KiotViet

3. **Sync Problems**
   - Review sync logs in ACTA E-Commerce
   - Check field mappings for any conflicts
   - Verify default categories and settings are valid

### Sync Logs

All sync activities are logged for troubleshooting:

1. Go to Settings > Integrations > KiotViet > Logs
2. Filter by date, event type, or status
3. View detailed error messages for failed syncs

## API Reference

The integration exposes the following API endpoints:

| Method | Endpoint                                                                         | Description                       |
| ------ | -------------------------------------------------------------------------------- | --------------------------------- |
| GET    | `/api/integrations/kiotviet/config/:organizationId`                              | Get integration configuration     |
| POST   | `/api/integrations/kiotviet/config`                                              | Create integration configuration  |
| PUT    | `/api/integrations/kiotviet/config/:organizationId`                              | Update integration configuration  |
| DELETE | `/api/integrations/kiotviet/config/:organizationId`                              | Delete integration configuration  |
| POST   | `/api/integrations/kiotviet/sync/from-kiotviet/:organizationId`                  | Manually sync from KiotViet       |
| POST   | `/api/integrations/kiotviet/sync/all`                                            | Sync all active organizations     |
| POST   | `/api/integrations/kiotviet/sync/product-to-kiotviet/:organizationId/:productId` | Sync specific product to KiotViet |
| GET    | `/api/integrations/kiotviet/test-connection/:organizationId`                     | Test API connection               |
| PUT    | `/api/integrations/kiotviet/sync/config/:organizationId`                         | Configure automatic sync settings |

## Security Considerations

This integration implements several security best practices:

1. **API Authentication**: Uses HTTP Basic Auth with your API key
2. **System Registration**: Includes required `X-System` and `X-System-Key` headers
3. **Webhook Verification**: Validates webhook signatures to prevent spoofing
4. **Role-Based Access**: Restricts integration management to admins and managers
5. **Data Protection**: No sensitive data is stored unnecessarily

## Technical Details

The integration is built using:

- NestJS framework for robust API development
- MongoDB for configuration and log storage
- NestJS Scheduler for automated sync jobs
- Webhook handlers for real-time updates
- Custom data mapping for field translation

## Support

For issues or questions about this integration, contact:

- ACTA E-Commerce Support: lienhe@acta.vn
- KiotViet Support: support@kiotviet.com
