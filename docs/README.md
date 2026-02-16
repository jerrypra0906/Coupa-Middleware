## Coupa Middleware

Custom Middleware for COUPA ↔ SAP S/4HANA Integration  
**KPN Downstream | 2026**

### Project Overview

KPN Downstream requires a custom-built middleware to integrate the COUPA e-Procurement system with SAP S/4HANA. This middleware functions as a secure, configurable, and scalable integration layer capable of handling API and SFTP/CSV-based data exchanges.

The middleware includes:
- **Admin Web Portal** - UI for configuration, monitoring, and operational workflows
- **Integration Scheduler** - Configurable timer-based integration runs
- **Logging System** - Comprehensive integration execution logs
- **Error Handling** - Line-item level error capture and retry mechanisms
- **Dashboard Monitoring** - Real-time integration health and metrics
- **Email Notification Engine** - Automated error alerts to stakeholders
- **PostgreSQL Database** - Staging data and logs storage

### Problem Statement

COUPA does not directly integrate with KPN's SAP S/4HANA instance, and the existing SAP team is unable to support all non-SAP integrations quickly. To maintain project speed and autonomy, a custom middleware solution is required.

### Goals & Objectives

**Goals:**
- Provide a robust integration layer between COUPA ↔ SAP S/4HANA
- Enable admins to fully configure integration frequency without coding
- Offer complete transparency on integration performance & errors
- Support both API and CSV/SFTP data exchange
- Ensure secure, traceable, and reliable sync of operational procurement data

**Objectives:**
- Automate data sync between COUPA and SAP with configurable schedules
- Build a unified system for log viewing, retry processing, and error diagnosis
- Provide dashboards for monitoring integration health
- Enable PostgreSQL-based staging to improve reliability and auditability
- Provide a UI-based administration panel for non-technical users

### High-Level Architecture

**Components:**

- **SAP S/4HANA**
  - Communicates using OData/API (outbound)
  - Accepts inbound data using custom Z-Programs / IDoc / API

- **COUPA**
  - Supports REST API
  - Supports CSV via SFTP

- **Custom Middleware**
  - **API Client** → Connects to SAP OData & COUPA APIs
  - **SFTP Client** → Handles CSV import/export
  - **Scheduler** → Timer-based runs for each module
  - **Transformation Engine** → Mapping logic between COUPA ⇄ SAP
  - **Error Engine** → Captures line-level errors
  - **Admin Website** → Integration configuration, logs viewer, retry engine, dashboard monitoring

- **PostgreSQL Database (Staging Layer)**
  - Stores staging data (inbound & outbound)
  - Stores logs
  - Stores error history

### In-Scope Integrations

#### 5.1 COUPA → SAP S/4HANA
- Suppliers
- Chart of Accounts
- Cost Centers
- Purchase Orders
- Invoices
- Payments status updates
- Goods Receipts (optional based on process)

#### 5.2 SAP → COUPA
- Vendor master
- Material/service master
- Purchase orders
- GR/IR
- Payment run results
- **Exchange Rates** (First module - implemented)

#### 5.3 Supported Integration Methods
- **API** → REST (JSON/XML)
- **CSV** → SFTP

### Repository Layout

- **`backend/`**: Backend application code (APIs, services, data access, integration logic)
  - Node.js/Express server
  - PostgreSQL database models
  - Integration modules (exchange-rate, suppliers, purchase-orders, invoices)
  - Transformation services
  - Scheduler service
  - Email notification service
  - SFTP service

- **`frontend/`**: Frontend application code (UI, routing, view components)
  - React SPA with Ant Design
  - Dashboard, Logs, Scheduler Config, Error Details, Email Config pages

- **`assets/`**: Shared assets and supporting files

- **`docs/`**: Product and technical documentation
  - `PRD_Middleware.txt`: Product Requirements Document
  - `TECHNICAL_DESIGN_Middleware.txt`: Technical Design Document

### Getting Started

#### Prerequisites

- **Node.js** (v18 or higher) and npm
- **PostgreSQL** (v12 or higher) database instance
- **Git** for version control

#### Installation

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

#### Environment Configuration

The middleware uses environment variables configured in `.env.staging` for staging environment.

**Staging Database Configuration:**

Create `backend/.env.staging`:
```env
NODE_ENV=staging
PORT=6001
DB_HOST=localhost
DB_PORT=5433
DB_NAME=coupa_middleware_staging
DB_USERNAME=postgres
DB_PASSWORD=postgres123
DB_SSL_MODE=prefer

# SAP Configuration
SAP_BASE_URL=https://sap-instance.com
SAP_CLIENT=100
SAP_USER=your_sap_user
SAP_PASSWORD=your_sap_password
SAP_LANGUAGE=EN
SAP_ODATA_ENDPOINT=/sap/opu/odata/SAP/Z_EXCHRATES_SRV/ExchangeRateSet

# COUPA Configuration
COUPA_API_BASE_URL=https://api.coupa.com
COUPA_API_KEY=your_coupa_api_key
COUPA_COMPANY_ID=your_company_id

# SFTP Configuration
SFTP_HOST=fileshare-sg-test.coupahost.com
SFTP_PORT=22
SFTP_USERNAME=kpn-test
SFTP_PASSWORD=kN032giiKs
SFTP_INCOMING_PATH=/Incoming
SFTP_OUTGOING_PATH=/Outgoing

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURITY=TLS
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=noreply@coupa-middleware.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:4005
```

**Frontend Configuration:**

Create `frontend/.env`:
```env
REACT_APP_API_BASE_URL=http://localhost:6001/api
REACT_APP_ENV=development
PORT=4005
```

#### Database Setup

1. **Create the database:**
```bash
# Using psql or pgAdmin, create the database:
CREATE DATABASE coupa_middleware_staging;
```

2. **Run migrations:**
```bash
cd backend
$env:NODE_ENV='staging'
node src/migrations/runMigrations.js
```

This will create all required tables and seed initial configuration.

#### Running the Project

**Start Backend:**
```bash
cd backend
$env:NODE_ENV='staging'
npm start
```

Backend will run on `http://localhost:6001`

**Start Frontend:**
```bash
cd frontend
npm start
```

Frontend will run on `http://localhost:4005` and should open automatically in your browser.

### Functional Requirements

#### 6.1 Middleware Admin Web Portal

**Authentication:**
- Admin login (username + password)
- Role-based access:
  - **Admin**: Full access, config scheduling, view logs, retry, configure email settings
  - **Integration Operator**: Monitor logs, run retries, receive error notifications
  - **Viewer**: Dashboard only, optional summary notifications

#### 6.2 Integration Scheduler

Admin can configure:
- Integration frequency (every 5m, 15m, 30m, hourly, etc.)
- Integration time window
- Enable/disable each integration module
- API method vs CSV method
- Retry mode: Automatic / Manual

Scheduler supports:
- Cron-based triggers
- Manual trigger
- Retry trigger

#### 6.3 Integration Logging & Monitoring

- Store logs in PostgreSQL
- Show logs in UI table with:
  - Integration name
  - Timestamp
  - Status: Success / Partial Success / Failed
  - Success Count
  - Error Count
  - Duration (ms)
- Logs searchable by: Date, Integration type, Status, PO number / Vendor number

#### 6.4 Error Handling

- Capture errors down to line item level
- Display error with: Line Number, Field Name, Error Message, Raw Payload
- Allow: Manual correction, Re-process single line, Re-process entire batch

#### 6.5 Dashboard Monitoring

- Daily sync volume (items processed)
- Success rate (%)
- Error trend last 7 days
- Integration duration metrics
- Top recurring error categories
- Queue backlog
- API latency
- SFTP upload/download volume
- Visual components: Line charts, Pie charts, Error tables, SLA gauge

#### 6.6 API Integration Engine

- Support REST JSON for COUPA
- Support OData/XML/API for SAP
- Implement mapping engine: JSON → PostgreSQL table, PostgreSQL → JSON
- Implement rate-limiting control
- Implement retry logic for: Network failure, Timeout, 429 Too Many Requests

#### 6.7 SFTP/CSV Integration Engine

- Connect to COUPA SFTP location
- Download CSV files
- Validate structure (column count, header match)
- Parse with error handling
- Upload outbound CSV files to COUPA SFTP

#### 6.9 Email Notification Engine

**Trigger Conditions:**
- Integration Failed (Status = FAIL)
- Partial Success (Status = PARTIAL)
- High Severity Error

**Email Content:**
- Integration Name
- Timestamp
- Execution Status
- Total Records Processed
- Number of Errors
- Error Summary Table
- Direct link to log detail page in Admin UI

**Admin Configuration:**
- Recipient List (add/remove email addresses)
- Multiple groups (IT Ops, Purchasing, COUPA Admin, SAP Team)
- Notification type: Critical only / Critical + Partial / All logs
- Toggle notifications (ON / OFF) per integration module
- Test Email Button
- SMTP configuration

### User Roles

| Role | Responsibilities |
|------|------------------|
| **Admin** | Full access, config scheduling, view logs, retry, configure email settings, manage notification rules |
| **Integration Operator** | Monitor logs, run retries, receive error notifications, perform root cause checks |
| **Viewer** | Dashboard only, receive summary-only notifications (optional) |

### Success KPIs

| KPI | Target |
|-----|--------|
| Sync success rate | ≥ 98% |
| Error resolution time | ≤ 24 hours |
| Integration latency | < 5 seconds per API call |
| Scheduler reliability | 99% on-time runs |
| Email delivery success rate | 100% |
| Time to notify error | < 60 seconds after integration run |

### Non-Functional Requirements

- **Performance**: Must process 10,000 line items under 2 minutes
- **Security**: HTTPS, Token-based auth for APIs, Password encryption, Audit trails
- **Scalability**: Able to integrate new modules in future with minimal development
- **Availability**: 99.5% uptime

### Technology Stack

- **Backend**: Node.js, Express.js, PostgreSQL
- **Frontend**: React, Ant Design, React Router
- **Scheduling**: node-cron
- **Email**: nodemailer
- **SFTP**: ssh2-sftp-client
- **Logging**: Winston

### API Endpoints

- `GET /health` - Health check
- `GET /api` - API information and available endpoints
- `GET /api/integrations` - List all integrations
- `GET /api/integrations/:name` - Get integration details
- `POST /api/integrations/:name/trigger` - Manually trigger integration
- `GET /api/logs` - Get integration logs
- `GET /api/logs/:id` - Get log details
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/schedulers` - Get scheduler configurations
- `PUT /api/schedulers/:name` - Update scheduler configuration
- `GET /api/email-config/recipients` - Get email recipients
- `POST /api/email-config/recipients` - Add email recipient

### Development Roadmap

See `IMPLEMENTATION_PLAN.md` for detailed step-by-step implementation plan.

### Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Deployment

- **Staging**: Configured via `.env.staging`
- **Production**: Configure via `.env.production` (create as needed)
- Environment variables are injected per environment
- Database migrations run automatically on deployment

### Support & Documentation

- **PRD**: `docs/PRD_Middleware.txt`
- **Technical Design**: `docs/TECHNICAL_DESIGN_Middleware.txt`
- **API Documentation**: Available at `/api` endpoint when server is running
