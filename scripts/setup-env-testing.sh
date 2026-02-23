#!/bin/bash

# Script to create .env.testing files from templates
# This script creates environment files for testing deployment

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "Setting up environment files for testing deployment..."
echo ""

# Create backend .env.testing
if [ -f "$PROJECT_ROOT/backend/env.template" ]; then
    echo "Creating backend/.env.testing from template..."
    cat > "$PROJECT_ROOT/backend/.env.testing" << 'EOF'
# Application Configuration - Testing Environment
NODE_ENV=testing
PORT=6001
API_BASE_URL=http://172.28.92.57:6001/api

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=coupa_middleware_staging
DB_USERNAME=admincoupa
DB_PASSWORD=admincoupa@2025
DB_SSL_MODE=disable

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

# COUPA OAuth2 Configuration (preferred)
COUPA_OAUTH_TOKEN_URL=https://kpn-test.coupahost.com/oauth2/token
COUPA_OAUTH_API_BASE_URL=https://kpn-test.coupahost.com
COUPA_OAUTH_CLIENT_ID=your_oauth_client_id
COUPA_OAUTH_CLIENT_SECRET=your_oauth_client_secret
COUPA_OAUTH_SCOPE=core.accounting.read core.accounting.write core.contract.read core.contract.write core.supplier.read core.supplier.write

# SFTP Configuration
SFTP_HOST=fileshare-sg-test.coupahost.com
SFTP_PORT=22
SFTP_USERNAME=kpn-test
SFTP_PASSWORD=pxvsMAg56u
SFTP_INCOMING_PATH=/Outgoing/Contract
SFTP_OUTGOING_PATH=/Incoming

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURITY=TLS
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=noreply@coupa-middleware.com

# Security
JWT_SECRET=your_jwt_secret_key_change_in_production
SESSION_SECRET=your_session_secret_change_in_production
ENCRYPTION_KEY=your_encryption_key_change_in_production

# Logging
LOG_LEVEL=info
LOG_RETENTION_DAYS=365

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL (for CORS)
FRONTEND_URL=http://172.28.92.56:8080
EOF
    echo "✓ Created backend/.env.testing"
else
    echo "⚠ backend/env.template not found, skipping..."
fi

# Create frontend .env.testing
echo ""
echo "Creating frontend/.env.testing..."
cat > "$PROJECT_ROOT/frontend/.env.testing" << 'EOF'
REACT_APP_API_BASE_URL=http://172.28.92.57:6001/api
REACT_APP_ENV=testing
EOF
echo "✓ Created frontend/.env.testing"

echo ""
echo "=========================================="
echo "Environment files created successfully!"
echo "=========================================="
echo ""
echo "IMPORTANT: Update the following values in backend/.env.testing:"
echo "  - SAP credentials (SAP_USER, SAP_PASSWORD, SAP_BASE_URL)"
echo "  - COUPA credentials (COUPA_OAUTH_CLIENT_ID, COUPA_OAUTH_CLIENT_SECRET)"
echo "  - SMTP credentials (SMTP_USER, SMTP_PASSWORD, SMTP_HOST)"
echo "  - Security keys (JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY)"
echo ""

