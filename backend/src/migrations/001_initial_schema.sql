-- Initial Database Schema for Coupa Middleware
-- PostgreSQL Database

-- Exchange Rate Staging Table
CREATE TABLE IF NOT EXISTS exchange_rate_staging (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate_value NUMERIC(20, 8) NOT NULL,
    rate_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'NEW' CHECK (status IN ('NEW', 'PROCESSED', 'ERROR')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_currency, to_currency, rate_date)
);

CREATE INDEX idx_exchange_rate_status ON exchange_rate_staging(status);
CREATE INDEX idx_exchange_rate_date ON exchange_rate_staging(rate_date);

-- Integration Log Table
CREATE TABLE IF NOT EXISTS integration_log (
    id SERIAL PRIMARY KEY,
    integration_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL')),
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_integration_log_name ON integration_log(integration_name);
CREATE INDEX idx_integration_log_status ON integration_log(status);
CREATE INDEX idx_integration_log_created ON integration_log(created_at);

-- Integration Error Detail Table
CREATE TABLE IF NOT EXISTS integration_error_detail (
    id SERIAL PRIMARY KEY,
    integration_log_id INTEGER NOT NULL REFERENCES integration_log(id) ON DELETE CASCADE,
    line_number INTEGER,
    field_name VARCHAR(100),
    error_message TEXT NOT NULL,
    raw_payload JSONB,
    retry_status VARCHAR(20) DEFAULT 'PENDING' CHECK (retry_status IN ('PENDING', 'RETRYING', 'RETRIED', 'IGNORED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_error_detail_log_id ON integration_error_detail(integration_log_id);
CREATE INDEX idx_error_detail_retry_status ON integration_error_detail(retry_status);

-- Integration Configuration Table
CREATE TABLE IF NOT EXISTS integration_configuration (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(100) UNIQUE NOT NULL,
    execution_interval VARCHAR(50) NOT NULL, -- e.g., '5m', '15m', '1h', '0 0 * * *' (cron)
    integration_mode VARCHAR(20) NOT NULL CHECK (integration_mode IN ('API', 'CSV', 'BOTH')),
    is_active BOOLEAN DEFAULT true,
    sap_endpoint TEXT,
    coupa_endpoint TEXT,
    retry_mode VARCHAR(20) DEFAULT 'MANUAL' CHECK (retry_mode IN ('AUTOMATIC', 'MANUAL')),
    config_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_integration_config_active ON integration_configuration(is_active);

-- Notification Recipients Table
CREATE TABLE IF NOT EXISTS notification_recipients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'CRITICAL' CHECK (notification_type IN ('CRITICAL', 'CRITICAL_PARTIAL', 'ALL')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, group_name)
);

CREATE INDEX idx_notification_recipients_group ON notification_recipients(group_name);
CREATE INDEX idx_notification_recipients_active ON notification_recipients(is_active);

-- Retry Queue Table
CREATE TABLE IF NOT EXISTS retry_queue (
    id SERIAL PRIMARY KEY,
    integration_name VARCHAR(100) NOT NULL,
    error_detail_id INTEGER REFERENCES integration_error_detail(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_retry_queue_status ON retry_queue(status);
CREATE INDEX idx_retry_queue_next_retry ON retry_queue(next_retry_at);
CREATE INDEX idx_retry_queue_integration ON retry_queue(integration_name);

-- Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_trail_user ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at);

-- Users Table (for Admin Portal)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'INTEGRATION_OPERATOR', 'VIEWER')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Email Notification Log Table
CREATE TABLE IF NOT EXISTS email_notification_log (
    id SERIAL PRIMARY KEY,
    integration_log_id INTEGER REFERENCES integration_log(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SENT', 'FAILED', 'PENDING')),
    error_message TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_notification_log_id ON email_notification_log(integration_log_id);
CREATE INDEX idx_email_notification_status ON email_notification_log(status);
CREATE INDEX idx_email_notification_created ON email_notification_log(created_at);

