# KiotViet Integration Troubleshooting Guide

This guide provides solutions for common issues encountered with the KiotViet integration in ACTA E-Commerce.

## Authentication Issues

### API Key Invalid

**Symptoms:**

- "Unauthorized" errors when attempting to connect to KiotViet
- Test connection fails with 401 status code

**Solutions:**

1. Verify your API key in the integration settings
2. Ensure the API key is active in KiotViet (Admin > API)
3. Check that your KiotViet account has API access enabled

### System Registration Problems

**Symptoms:**

- "System not recognized" errors in API responses
- 403 Forbidden responses when making API calls

**Solutions:**

1. Make sure `systemName` and `systemKey` are properly configured
2. Verify your system has been registered with KiotViet support
3. Check HTTP headers in requests to ensure X-System headers are being sent

## Webhook Issues

### Webhook Not Receiving Events

**Symptoms:**

- Changes in KiotViet not reflecting in ACTA E-Commerce
- No webhook events in logs

**Solutions:**

1. Verify webhook URL is correct in KiotViet
2. Check webhook is enabled for the events you want to receive
3. Ensure your server is accessible from the internet
4. Check firewall settings to allow incoming connections

### Invalid Signature Errors

**Symptoms:**

- Webhook events are rejected with "Invalid signature" errors
- Events reach the server but fail validation

**Solutions:**

1. Ensure the webhook secret in ACTA E-Commerce matches the one in KiotViet
2. Check that the webhook secret hasn't expired in KiotViet
3. Regenerate the webhook secret in KiotViet and update in ACTA E-Commerce

## Synchronization Problems

### Data Not Syncing

**Symptoms:**

- Data changes in one system not reflecting in the other
- Sync logs show successful runs but data is missing

**Solutions:**

1. Check sync settings to ensure the entity type is enabled for syncing
2. Verify field mappings are correctly configured
3. Check for any validation errors in the sync logs
4. Try a manual sync and check for specific error messages

### Duplicate Data

**Symptoms:**

- Multiple copies of the same product or customer appear
- Orders or invoices appear duplicated after sync

**Solutions:**

1. Check for unique identifier mappings (like product code or customer ID)
2. Review the deduplication settings in both systems
3. Run a cleanup process to merge duplicates

### Scheduled Sync Not Running

**Symptoms:**

- Automatic sync not running at expected intervals
- No scheduler entries in logs

**Solutions:**

1. Verify `enableAutoSync` is set to true in the config
2. Check that `syncIntervalMinutes` is set to a valid value
3. Ensure the NestJS scheduler is properly initialized
4. Restart the application to reinitialize the scheduler

## Field Mapping Issues

### Custom Fields Not Syncing

**Symptoms:**

- Standard fields sync correctly but custom fields don't transfer
- Custom field data appears empty after sync

**Solutions:**

1. Verify custom field API names in KiotViet
2. Check that custom fields are properly mapped in configuration
3. Ensure custom fields exist in both systems
4. Verify field types are compatible

### Data Type Mismatches

**Symptoms:**

- Sync errors related to data validation
- Unexpected data format after sync

**Solutions:**

1. Check field types match between systems
2. Add data transformation in the mapping service
3. Review date format conversion functions

## Performance Issues

### Slow Sync Performance

**Symptoms:**

- Syncs take much longer than expected
- Timeout errors during sync

**Solutions:**

1. Implement pagination for large data sets
2. Reduce sync frequency for large organizations
3. Use incremental sync instead of full sync when possible
4. Set up separate sync jobs for different entity types

### High API Usage

**Symptoms:**

- API rate limit warnings from KiotViet
- Throttling of requests

**Solutions:**

1. Implement retry with exponential backoff
2. Distribute sync jobs throughout the day
3. Use batch operations where available
4. Cache frequently accessed data

## Error Handling

### Understanding Error Logs

The integration logs errors with specific formats:

```
[ERROR] KiotVietService - API Error: {error message} | Status: {status code} | Path: {api path}
[ERROR] KiotVietSyncService - Sync failed: {organization id} | Entity: {entity type} | Reason: {error details}
```

Common error codes:

- 401: Authentication failure (check API key)
- 403: Permission denied (check system registration)
- 404: Resource not found (check entity IDs)
- 422: Validation error (check request format or field mappings)
- 429: Rate limit exceeded (implement backoff strategy)

### Debugging Steps

1. **Review Sync Logs**: Check `KiotVietSyncLog` collection for detailed error messages
2. **Enable Trace Logging**: Temporarily set logging level to trace for more details
3. **HTTP Analysis**: Use tools like Postman to test API endpoints directly
4. **Test Individual Components**: Run targeted tests on specific sync functions
5. **Check Recent Changes**: Review if recent changes to schemas or APIs could be causing issues

## Advanced Configuration

### Custom Sync Scenarios

If you need specialized sync behavior:

1. Extend the `KiotVietMappingService` with custom mapping functions
2. Create event listeners to trigger syncs on specific e-commerce events
3. Implement data transformers for complex field conversions

### Handling Large Data Volumes

For organizations with large data sets:

1. Configure staggered sync schedules for different entity types
2. Implement incremental sync using timestamp filtering
3. Consider sync prioritization based on entity importance
4. Use batch operations when available in the KiotViet API

---

If problems persist after trying these solutions, contact:

- ACTA E-Commerce Support: lienhe@acta.vn
- KiotViet Support: support@kiotviet.com
