# KiotViet Integration Documentation

Welcome to the documentation for the KiotViet integration with ACTA E-Commerce. This documentation will help you understand, set up, and troubleshoot the integration between these two systems.

## Documentation Index

1. [README.md](./README.md) - Main overview and setup instructions
2. [INTEGRATION_DIAGRAM.md](./INTEGRATION_DIAGRAM.md) - Visual representations of data flows and architecture
3. [API_REFERENCE.md](./API_REFERENCE.md) - Detailed API endpoint documentation
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Solutions for common issues

## Quick Start

To get started with the KiotViet integration:

1. Register your system with KiotViet (see [README](./README.md))
2. Configure the integration in ACTA E-Commerce
3. Set up webhooks in KiotViet
4. Perform an initial sync

## Key Features

- **Bidirectional Sync**: Keep data in sync between both systems
- **Real-time Updates**: Receive webhook notifications for instant updates
- **Flexible Scheduling**: Configure sync intervals based on your needs
- **Custom Field Mapping**: Map fields between systems for seamless data flow

## Development Resources

For developers working on extending or customizing the integration:

- Code is located in `server/src/integrations/kiotviet/`
- Follow TypeScript and NestJS conventions
- Use the [API Reference](./API_REFERENCE.md) for endpoint documentation
- Refer to architecture diagrams for understanding system design

## Support

If you encounter issues or have questions:

- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Contact ACTA E-Commerce Support: lienhe@acta.vn
- For API-specific questions, contact KiotViet: support@kiotviet.com
