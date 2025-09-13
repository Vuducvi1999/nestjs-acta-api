# ACTA E-Commerce API

## Database Connection Management

### Environment Variables

To prevent "Max client connections reached" errors, configure these environment variables:

```bash
# Database connection settings
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
DIRECT_URL="postgresql://username:password@localhost:5432/database_name"

# Connection pool settings (optional, defaults shown)
DATABASE_MAX_CONNECTIONS=10
DATABASE_CONNECTION_TIMEOUT=30000
DATABASE_IDLE_TIMEOUT=30000
```

### Health Check Endpoints

The API provides health check endpoints to monitor database connections:

- `GET /health` - Overall application health
- `GET /health/db` - Database health status
- `GET /health/connections` - Current connection status

### Connection Management Features

- **Automatic connection limiting**: Prevents exceeding max connections
- **Connection pooling**: Efficiently manages database connections
- **Graceful shutdown**: Properly closes connections on app termination
- **Health monitoring**: Real-time connection status monitoring
- **Error handling**: Robust error handling for connection issues

### Troubleshooting Connection Issues

If you encounter "Max client connections reached":

1. Check current connections: `GET /health/connections`
2. Restart the application to reset connections
3. Check for long-running queries or transactions
4. Verify database server connection limits
5. Monitor connection usage over time

### Development vs Production

- **Development**: Lower connection limits (5-10)
- **Production**: Higher connection limits (20-50) based on load
- **Monitoring**: Always enable health checks in production
