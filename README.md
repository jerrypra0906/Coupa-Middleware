# Coupa Middleware - SAP S/4HANA Integration

## Table of Contents
1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Goals & Objectives](#goals--objectives)
4. [High-Level Architecture](#high-level-architecture)
5. [In-Scope Integrations](#in-scope-integrations)
6. [Functional Requirements](#functional-requirements)
7. [Technical Design](#technical-design)
8. [Database Design](#database-design)
9. [Environment Configuration](#environment-configuration)
10. [User Roles](#user-roles)
11. [Success KPIs](#success-kpis)
12. [Risk & Mitigation](#risk--mitigation)
13. [Security Requirements](#security-requirements)
14. [Non-Functional Requirements](#non-functional-requirements)

---

## Project Overview

KPN Downstream requires a custom-built middleware to integrate the COUPA e-Procurement system with SAP S/4HANA. This middleware functions as a secure, configurable, and scalable integration layer capable of handling API and SFTP/CSV-based data exchanges.

The middleware includes:
- **Admin Web Portal** - Configuration and monitoring interface
- **Integration Scheduler** - Timer-based execution engine
- **Logging System** - Comprehensive audit trail
- **Error Handling** - Line-item level error capture and retry
- **Dashboard Monitoring** - Real-time integration health metrics
- **PostgreSQL Database** - Staging data and logs storage
- **Email Notification Engine** - Automated error alerts

---

## Problem Statement

COUPA does not directly integrate with KPN's SAP S/4HANA instance, and the existing SAP team is unable to support all non-SAP integrations quickly. To maintain project speed and autonomy, a custom middleware solution is required.

---

## Goals & Objectives

### Goals
- Provide a robust integration layer between COUPA ↔ SAP S/4HANA
- Enable admins to fully configure integration frequency without coding
- Offer complete transparency on integration performance & errors
- Support both API and CSV/SFTP data exchange
- Ensure secure, traceable, and reliable sync of operational procurement data

### Objectives
- Automate data sync between COUPA and SAP with configurable schedules
- Build a unified system for log viewing, retry processing, and error diagnosis
- Provide dashboards for monitoring integration health
- Enable PostgreSQL-based staging to improve reliability and auditability
- Provide a UI-based administration panel for non-technical users

---

## High-Level Architecture

### Components

#### SAP S/4HANA
- Communicates using OData/API (outbound)
- Accepts inbound data using custom Z-Programs / IDoc / API

#### COUPA
- Supports REST API
- Supports CSV via SFTP

#### Custom Middleware (New System)
- **API Client** → Connects to SAP OData & COUPA APIs
- **SFTP Client** → Handles CSV import/export
- **Scheduler** → Timer-based runs for each module
- **Transformation Engine** → Mapping logic between COUPA ⇄ SAP
- **Error Engine** → Captures line-level errors
- **Admin Website** → Integration configuration, logs viewer, retry engine, dashboard monitoring
- **Notification Service** → Email alerts for errors

#### PostgreSQL Database (Staging Layer)
- Stores staging data (inbound & outbound)
- Stores logs
- Stores error history
- Stores integration configuration
- Stores retry queue
- Stores audit trail

---

## In-Scope Integrations

### 5.1 COUPA → SAP S/4HANA
- Suppliers
- Chart of Accounts
- Cost Centers
- Purchase Orders
- Invoices
- Payments status updates
- Goods Receipts (optional based on process)

### 5.2 SAP → COUPA
- Vendor master
- Material/service master
- Purchase orders
- GR/IR
- Payment run results
- **Exchange Rates** (detailed module)
- **Contracts / Outline Agreements** (detailed module – see Technical Design)

### 5.3 Supported Integration Methods
- **API** → REST (JSON/XML)
- **CSV** → SFTP

---

## Functional Requirements

### 6.1 Middleware Admin Web Portal

#### 6.1.1 Authentication
- Admin login (username + password)
- Role-based access:
  - **Admin** - Full access, config scheduling, view logs, retry
  - **View-only** - Dashboard only
  - **Integration Operator** - Monitor logs, run retries

### 6.2 Integration Scheduler

**Requirements:**
- Admin can configure:
  - Integration frequency (every 5m, 15m, 30m, hourly, etc.)
  - Integration time window
  - Enable/disable each integration module
  - API method vs CSV method
- Scheduler must support:
  - Cron-based triggers
  - Manual trigger
  - Retry trigger

### 6.3 Integration Logging & Monitoring

**Requirements:**
- Store logs in PostgreSQL DB
- Show logs in UI table:
  - Integration name (PO Sync, Invoice Sync, Vendor Sync, Exchange Rate Sync, etc.)
  - Timestamp
  - Status: Success / Partial Success / Failed
  - Success Count
  - Error Count
  - Duration (ms)
- Logs must be searchable by:
  - Date
  - Integration type
  - Status
  - PO number / Vendor number / Currency pair

### 6.4 Error Handling

**Requirements:**
- Capture errors down to line item level
- Display error with:
  - Line Number
  - Field Name
  - Error Message from SAP or COUPA
  - Raw Payload
- Allow:
  - Manual correction
  - Re-process single line
  - Re-process entire batch

### 6.5 Dashboard Monitoring

**Requirements:**
- Daily sync volume (items processed)
- Success rate (%)
- Error trend last 7 days
- Integration duration metrics
- Top recurring error categories
- Queue backlog
- API latency
- SFTP upload/download volume
- Visual components:
  - Line charts
  - Pie charts
  - Error tables
  - SLA gauge

### 6.6 API Integration Engine

**Requirements:**
- Support REST JSON for COUPA
- Support OData/XML/API for SAP
- Implement mapping engine:
  - JSON → PostgreSQL table
  - PostgreSQL → JSON
- Implement rate-limiting control
- Implement retry logic for:
  - Network failure
  - Timeout
  - 429 Too Many Requests

### 6.7 SFTP/CSV Integration Engine

**Requirements:**
- Connect to COUPA SFTP location
- Download CSV files
- Validate structure (column count, header match)
- Parse with error handling
- Upload outbound CSV files to COUPA SFTP

### 6.8 PostgreSQL Database

**Required Tables:**
- Staging tables (per module)
  - `EXCHANGE_RATE_STAGING` (for Exchange Rate module)
  - Other module-specific staging tables
- `INTEGRATION_LOG` - Execution results
- `INTEGRATION_ERROR_DETAIL` - Line-item errors
- `INTEGRATION_CONFIGURATION` - Scheduler and module settings
- `RETRY_QUEUE` - Failed items for retry
- `NOTIFICATION_RECIPIENTS` - Email recipients configuration
- `AUDIT_TRAIL` - System audit logs

### 6.9 Email Notification Engine

#### 6.9.1 Email Notification Trigger Conditions
The middleware automatically sends email notifications under:
- **Integration Failed (Status = FAIL)**
  - Error occurs at batch level
  - API or SFTP connection failure
  - Timeout
  - Mapping failure
- **Partial Success (Status = PARTIAL)**
  - Some line items succeeded
  - Some items failed and need manual intervention
- **High Severity Error**
  - Missing mandatory fields (e.g., Vendor Code, PO Number)
  - SAP posting error
  - COUPA validation error
  - PostgreSQL staging error
- **System-level failure**
  - Scheduler fails to trigger
  - Database connection issue
  - Authentication token expired

#### 6.9.2 Email Content Requirements
Every error email must contain:
- Integration Name (e.g., PO Sync, Invoice Sync, Vendor Sync, Exchange Rate Sync)
- Timestamp of run
- Execution Status (Failed / Partial)
- Total Records Processed
- Number of Errors
- Error Summary Table:
  - Line Number
  - Field Name
  - Error Message
- Direct link to:
  - Log detail page in Admin UI
  - Retry button

**Subject Line Format:** `[COUPA-SAP Integration] ERROR – <Integration Name> – <Timestamp>`

#### 6.9.3 Admin Configuration Requirements
Email Settings page in Admin Portal allows:
- **Recipient List** (add/remove email addresses)
  - Multiple groups (IT Ops, Purchasing, COUPA Admin, SAP Team)
- **Notification type:**
  - Critical only
  - Critical + Partial
  - All logs
- **Toggle notifications** (ON / OFF) per integration module
- **Test Email Button**
- **SMTP or API email provider credentials:**
  - SMTP Host
  - Port
  - Security Type (TLS/SSL)
  - User
  - Password

#### 6.9.4 Email Frequency Control
To avoid spam:
- If the same error repeats within X minutes, send only 1 email (configurable)
- Provide digest mode:
  - Immediate
  - Every 30 minutes
  - 1-hour digest
  - Daily summary

---

## Technical Design

### Exchange Rate Integration Module

#### Purpose
This module integrates SAP Exchange Rates with Coupa through the Custom Middleware. It pulls exchange rates from SAP, formats them, stores them in the middleware staging DB, generates CSV/API payload, and sends it to Coupa based on admin-configured schedule.

#### High-Level End-to-End Flow
1. Middleware scheduler triggers job (interval defined by admin)
2. Middleware calls SAP OData/API/Z-program to pull exchange rate data
3. Middleware processes data:
   - Apply SAP business rules (including "/" prefix conversion)
   - Map fields to Coupa structure
   - Generate CSV or JSON (based on integration type)
4. Middleware sends file via:
   - SFTP folder (Incoming/ExchangeRates)
   - Or Coupa API endpoint
5. Coupa processes file and returns response
6. Middleware logs success or error per line item
7. If error:
   - Error stored in DB
   - Email notification sent to configured recipients
   - Admin can drill down to detailed error in UI
   - Admin can re-run integration manually

#### Technical Architecture (Module Scope)
**Landscape:**
- **SAP S/4HANA** – Source of Exchange Rates
- **Middleware (Custom Web Platform)**
  - Web Admin UI
  - Scheduler Service
  - Integration Engine
  - Log Engine
  - Notification Service
- **PostgreSQL Database**
- **Coupa** – Target system

**Transport Method Supported:**
- CSV over SFTP
- JSON via REST API

#### Data Source & SAP Specification

**SAP Table Reference:**

| Table | Description | Key Fields |
|-------|-------------|------------|
| TCURR | Exchange Rates | FCURR, TCURR, GDATU, UKURS |
| TVARVC | Selection variables | NAME, LOW, HIGH |
| Custom SAP Z-program | Provides filtered rate output | ZFI_EXCRAT_SC |

#### Middleware Functional Logic

**5.1 Data Extraction Logic (from SAP)**
Middleware calls SAP using:
- **Option A:** SAP OData Service `/sap/opu/odata/SAP/Z_EXCHRATES_SRV/ExchangeRateSet`
- **Option B:** SAP RFC via API Gateway
- **Option C:** Z-program execution via API - Trigger: `ZFI_EXCRAT_SC`

**5.2 Business Logic Replicated in Middleware**
1. Get currency conversion list
   - Query equivalent of TVARVC list
   - List of (From Currency → To Currency) pairs
2. Pull Exchange Rate Data
   - Read FCURR, TCURR, GDATU, UKURS
3. **Special Rule: "/" Prefix Conversion**
   - If rate = /15000
   - → System converts to: 1 / 15000 = 0.00006667 (8 decimal places)
4. Data Mapping (detailed below)
5. Write to PostgreSQL staging DB
6. Generate File (CSV or JSON)
7. Send to Coupa

#### Field Mapping (SAP → Middleware → Coupa)

| Coupa Column | Description | SAP Field | Middleware Field |
|--------------|-------------|-----------|------------------|
| From Currency | Base currency | TCURR-FCURR | from_currency |
| To Currency | Target currency | TCURR-TCURR | to_currency |
| Rate | Converted or raw rate | TCURR-UKURS | rate_value |
| Rate Date | Valid From | TCURR-GDATU | rate_date |

---

## Database Design

### PostgreSQL Database Schema

#### Table: EXCHANGE_RATE_STAGING

| Field Name | Type | Description |
|------------|------|-------------|
| id | PK | Auto ID |
| from_currency | VARCHAR(3) | SAP FCURR |
| to_currency | VARCHAR(3) | SAP TCURR |
| rate_value | NUMBER(20,8) | Converted UKURS |
| rate_date | DATE | SAP GDATU |
| status | VARCHAR(20) | NEW / PROCESSED / ERROR |
| created_at | TIMESTAMP | — |
| updated_at | TIMESTAMP | — |

#### Table: INTEGRATION_LOG
Captures each execution result with:
- Integration name
- Timestamp
- Status (Success / Partial / Failed)
- Success count
- Error count
- Duration (ms)
- Total records processed

#### Table: INTEGRATION_ERROR_DETAIL
Captures line-item error message with:
- Integration log ID (FK)
- Line number
- Field name
- Error message
- Raw payload
- Retry status

#### Table: NOTIFICATION_RECIPIENTS
Stores email recipients configurable from UI:
- Email address
- Group name
- Notification type
- Active status

#### Table: INTEGRATION_CONFIGURATION
Stores scheduler and module settings:
- Module name
- Execution interval
- Integration mode (CSV / API)
- Active/Inactive status
- SAP endpoint configuration
- Coupa SFTP/API credentials
- Retry mode (Automatic / Manual)

---

## Environment Configuration

### Staging Database Configuration

For the staging environment, use the following PostgreSQL database configuration in your `.env` file:

```env
# Staging Database Configuration
DB_HOST=localhost
DB_PORT=5434
DB_NAME=coupa_middleware_staging
DB_USERNAME=admincoupa
DB_PASSWORD=admincoupa@2025
DB_SSL_MODE=prefer
```

### Development Environment

```env
# Development Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coupa_middleware_dev
DB_USERNAME=postgres
DB_PASSWORD=your_dev_password
DB_SSL_MODE=disable
```

### Production Environment

```env
# Production Database Configuration
DB_HOST=your_production_host
DB_PORT=5432
DB_NAME=coupa_middleware_prod
DB_USERNAME=your_prod_username
DB_PASSWORD=your_prod_password
DB_SSL_MODE=require
```

### Additional Environment Variables

```env
# Application Configuration
NODE_ENV=staging
PORT=3000
API_BASE_URL=https://api.coupa.com
SAP_BASE_URL=https://sap-instance.com

# SAP Configuration
SAP_CLIENT=100
SAP_USER=your_sap_user
SAP_PASSWORD=your_sap_password
SAP_LANGUAGE=EN

# COUPA Configuration
COUPA_API_KEY=your_coupa_api_key
COUPA_COMPANY_ID=your_company_id

# SFTP Configuration
SFTP_HOST=your_sftp_host
SFTP_PORT=22
SFTP_USERNAME=your_sftp_username
SFTP_PASSWORD=your_sftp_password
SFTP_INCOMING_PATH=/Incoming/ExchangeRates
SFTP_OUTGOING_PATH=/Outgoing

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURITY=TLS
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=noreply@coupa-middleware.com

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
ENCRYPTION_KEY=your_encryption_key

# Logging
LOG_LEVEL=info
LOG_RETENTION_DAYS=365
```

---

## Admin Web UI Requirements

### 8.1 Scheduler Configuration Page
Admin can configure:
- Execution interval (minutes/hours/daily)
- Integration mode (CSV / API)
- Active/Inactive toggle
- SAP endpoint configuration
- Coupa SFTP/API credentials
- Retry mode: Automatic / Manual

### 8.2 Log Monitoring Page
Displays:
- Execution timestamp
- Total records
- Success count
- Error count
- Duration
- Status (Success / Partial / Failed)
- With drill-down for each line item

### 8.3 Error Details Page
Shows:
- From Currency
- To Currency
- Rate
- Rate Date
- Coupa return message
- Integration step failed
- Retry button

### 8.4 Email Notification Setup
Admin can:
- Add/Delete email recipients
- Enable/Disable notifications
- Test-email button
- Configure notification types and frequency

---

## Integration File Format Specification

### CSV Format (per Coupa Standard)

**Filename:** `ExchangeRate_YYYYMMDD_HHMMSS.csv`

**Delimiter:** comma

**Columns:**
- From Currency
- To Currency
- Rate
- Rate Date

**Example:**
```csv
"IDR","USD","0.00006667","20250115"
"USD","EUR","0.91000000","20250115"
```

### JSON Format (API)

```json
{
  "exchange_rates": [
    {
      "from_currency": "IDR",
      "to_currency": "USD",
      "rate": "0.00006667",
      "rate_date": "2025-01-15"
    },
    {
      "from_currency": "USD",
      "to_currency": "EUR",
      "rate": "0.91000000",
      "rate_date": "2025-01-15"
    }
  ]
}
```

---

## Integration Error Handling

### Error Categories

#### 10.1 Technical Errors
- Network failure
- SFTP authentication failed
- API timeout
- SAP connection failure

#### 10.2 Functional Errors
- Invalid date format
- Missing currency mapping
- Invalid rate (null or zero)
- Coupa rejected record

#### 10.3 Error Handling Flow
1. Error stored in database
2. UI shows line-item errors
3. Email sent to recipients
4. Admin can retry manually
5. Log is updated

---

## Dashboard Requirements

Dashboard will show:

**Widgets:**
- Integration Success Rate (%)
- Error Trend per Day
- Top 5 Most Failed Currency Pairs
- Last 10 Execution Summary
- Upcoming Scheduled Jobs
- Daily sync volume (items processed)
- Queue backlog
- API latency
- SFTP upload/download volume

**Visual Components:**
- Line charts
- Pie charts
- Error tables
- SLA gauge

---

## Test Scenarios (High-Level)

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC01 | Scheduler triggers job | Data pulled & processed |
| TC02 | Manual run | Admin can execute |
| TC03 | "/" prefix conversion | Correct 8-decimal output |
| TC04 | CSV generation | Valid format per Coupa |
| TC05 | API call success | Status = SUCCESS |
| TC06 | API call failure | Error logged + email sent |
| TC07 | UI shows logs | Accurate result |
| TC08 | View line-item error | Details shown |
| TC09 | Retry processing | Only error rows processed |
| TC10 | Change scheduler frequency | Scheduler updates |

---

## User Roles

| Role | Responsibilities |
|------|------------------|
| **Admin** | Full access, config scheduling, view logs, retry, configure email settings, set recipients, manage notification rules |
| **Integration Operator** | Monitor logs, run retries, receive error notifications, perform root cause checks |
| **Viewer** | Dashboard only, receive summary-only notifications (optional) |

---

## Success KPIs

| KPI | Target |
|-----|-------|
| Sync success rate | ≥ 98% |
| Error resolution time | ≤ 24 hours |
| Integration latency | < 5 seconds per API call |
| Scheduler reliability | 99% on-time runs |
| Manual retries reduced | 80% reduction in month 2 |
| Dashboard accuracy | 100% alignment with DB logs |
| Email delivery success rate | 100% |
| Time to notify error | < 60 seconds after integration run |
| Reduction of unreported failures | 90% reduction within Month 1 |
| Accuracy of email error details | 100% correct error mapping |
| Time to resolve errors due to faster alerts | 50% improvement |

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| High dependency on SAP team | Use OData + Z-program templates early |
| API limit on COUPA | Implement rate limit + batching |
| Data mismatch | Develop mapping validation engine |
| CSV format changes | Schema validation layer |
| Security breach | Token rotation + IP whitelist |
| Email spamming due to recurring errors | Implement suppression window + digest mode |
| Wrong recipients receiving alerts | Admin-managed recipient list |
| Email server downtime | Allow fallback to alternative SMTP or email API |
| Notification delays | Queue-based email dispatching |
| Sensitive data exposure | Mask critical values in email body |

---

## Security Requirements

- **OAuth2 or API Key** for Coupa API
- **Basic Auth or OAuth** for SAP API
- **Role-based access** for Admin UI
- **Encryption at rest** (PostgreSQL)
- **Encryption in transit** (HTTPS, SFTP SSH2)
- **Token-based authentication** for APIs
- **Password encryption** for stored credentials
- **Audit trails** for all system actions
- **IP whitelisting** for API access

---

## Non-Functional Requirements

### Performance
- Must process **10,000 line items under 2 minutes**
- Max processing time for 1 job: **< 3 minutes**
- Max daily volume: **10,000 exchange rate rows**
- Integration latency: **< 5 seconds per API call**

### Security
- **HTTPS** for all web traffic
- **Token-based auth** for APIs
- **Password encryption** for stored credentials
- **Audit trails** for compliance
- **Encryption at rest** and **in transit**

### Scalability
- Able to integrate new modules in future with minimal development
- Support horizontal scaling for high-volume processing

### Availability
- **99.5% uptime** target
- **99%** scheduler reliability (on-time runs)
- Graceful degradation on partial failures

### Logging & Retention
- **Log retention: 12 months**
- Comprehensive audit trail
- Line-item level error tracking

---

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Access to SAP S/4HANA system
- COUPA API credentials
- SFTP access (if using CSV method)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "Coupa Middleware"
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Set up environment variables:
   - Copy `.env.example` to `.env` in both `backend` and `frontend` directories
   - Update with your configuration (see [Environment Configuration](#environment-configuration))

5. Set up database:
```bash
cd backend
npm run migrate
```

6. Start the application:
```bash
# Backend
cd backend
npm start

# Frontend (in another terminal)
cd frontend
npm start
```

### Development

```bash
# Backend development
cd backend
npm run dev

# Frontend development
cd frontend
npm run dev
```

---

## Project Structure

```
Coupa Middleware/
├── backend/              # Backend API and services
│   ├── src/
│   │   ├── api/         # API routes
│   │   ├── services/    # Business logic
│   │   ├── models/      # Database models
│   │   ├── schedulers/  # Integration schedulers
│   │   ├── integrations/# Integration modules
│   │   └── utils/       # Utility functions
│   └── package.json
├── frontend/            # Admin web portal
│   ├── src/
│   │   ├── components/  # React/Vue components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   └── utils/       # Utility functions
│   └── package.json
├── docs/                # Documentation
│   ├── PRD Middleware.docx
│   └── TECHNICAL DESIGN Middleware.docx
├── assets/              # Static assets
└── README.md
```

---

## Support & Contact

For issues, questions, or contributions, please contact the development team or create an issue in the repository.

---

**Document Version:** 1.0  
**Last Updated:** 2025  
**Project:** KPN Downstream - Coupa Middleware Integration

