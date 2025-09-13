# KiotViet Integration Flow Diagrams

## Data Flow Overview

```
+----------------+                  +---------------+
|                |<-- Pull Data ----|               |
| KiotViet       |                  | ACTA E-Commerce|
|                |---- Push Data -->|               |
+----------------+                  +---------------+
        ^                                  ^
        |                                  |
        |                                  |
        +---------- Webhooks --------------+
```

## System Architecture

```
+-------------------------------------------------+
|                ACTA E-Commerce                |
|                                                 |
|  +-------------+        +-----------------+     |
|  |  Web UI     |<------>|  NestJS Backend |     |
|  +-------------+        +-----------------+     |
|                               |                 |
|                               v                 |
|  +-------------------------------------------------+
|  |            KiotViet Module                    |
|  |                                                |
|  |  +---------------+      +------------------+   |
|  |  | Config Service|<---->| Mapping Service  |   |
|  |  +---------------+      +------------------+   |
|  |         |                        |            |
|  |         v                        v            |
|  |  +---------------+      +------------------+  |
|  |  |KiotViet Service|<---->|  Sync Service    |  |
|  |  +---------------+      +------------------+  |
|  |         |                        |            |
|  |         |                        |            |
|  +---------+------------------------+------------+
|             |                       |
|             v                       v
|  +-----------------+      +-------------------+
|  |   Controllers   |      |  Webhook Handler  |
|  +-----------------+      +-------------------+
|             |                       |
+-------------------------------------------------+
             |                       |
             v                       v
+-----------------------------------------------+
|                  HTTP Transport              |
+-----------------------------------------------+
             |                       |
             v                       ^
+-----------------------------------------------+
|             KiotViet API                      |
+-----------------------------------------------+
```

## Synchronization Process

```
+-------------------------+     +------------------------+     +------------------------+
| 1. Configuration Setup  |---->| 2. Initial Data Load   |---->| 3. Ongoing Sync        |
+-------------------------+     +------------------------+     +------------------------+
| - Client ID             |     | - Fetch Branches       |     | - Scheduled Jobs       |
| - API Key               |     | - Fetch Products       |     | - Webhook Events       |
| - Base URL              |     | - Fetch Customers      |     | - Manual Triggers      |
| - Field Mappings        |     | - Fetch Users          |     | - Custom Schedules     |
| - Sync Settings         |     | - Fetch Categories     |     | - Auto Sync            |
| - Enable Auto Sync      |     | - Fetch Surchages      |     | - Sync Intervals       |
| - Sync Intervals        |     | - Fetch Bank Accounts  |     | - Last Sync Timestamp  |
+-------------------------+     | - Fetch Webhooks       |     +------------------------+
                                | - Fetch Orders          |
                                | - Fetch Invoices        |
                                | - Fetch Purchase Orders |
                                | - Fetch Returns         |
                                | - Fetch Transfers       |
                                | - Fetch Cashflow        |
                                +------------------------+
```

## Data Transformation Flow

```
  KiotViet                                   ACTA E-Commerce
  Data Format                               Data Format
+----------------+     +-------------------+     +---------------+
|KiotViet API Object|---->| Mapping Service   |---->| E-Commerce Entity|
+----------------+     +-------------------+     +---------------+
        ^                      |                        |
        |                      |                        |
        |                      v                        v
+----------------+     +-------------------+     +---------------+
|KiotViet API Object|<----| Mapping Service   |<----| E-Commerce Entity|
+----------------+     +-------------------+     +---------------+
```

## Webhook Processing Flow

```
 +----------------+     +---------------------+     +----------------------+
 | KiotViet       |---->| Webhook Controller  |---->| Event Identification |
 +----------------+     +---------------------+     +----------------------+
                                                              |
                                                              v
   +------------------+     +------------------+     +----------------------+
   | Update E-Commerce State |<----| Sync Service     |<----| Signature Validation |
   +------------------+     +------------------+     +----------------------+
```

## Scheduled Sync Process

```
 +------------------+     +----------------------+     +--------------------+
 | NestJS Scheduler |---->| Check Active Configs |---->| For Each Active Org|
 +------------------+     +----------------------+     +--------------------+
                                                               |
                                                               v
   +------------------+     +------------------+     +--------------------+
   | Log Results      |<----| Process Entities |<----| Apply Sync Settings|
   +------------------+     +------------------+     +--------------------+
```

## Custom Organization Schedules

```
 +---------------------+     +---------------------+     +----------------------+
 | Check Custom Config |---->| Filter By Interval  |---->| Execute If Due      |
 +---------------------+     +---------------------+     +----------------------+
         ^                                                        |
         |                                                        v
         |                   +---------------------+     +----------------------+
         +-------------------| Update Last Run     |<----| Record Results      |
                             +---------------------+     +----------------------+
```
