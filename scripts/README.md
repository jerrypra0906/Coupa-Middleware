# Deployment Scripts

This directory contains scripts for deploying the Coupa Middleware application to testing servers.

## Scripts Overview

### Port Checking
- **check-ports.sh** (Linux/Mac) - Checks if required ports are available
- **check-ports.ps1** (Windows PowerShell) - Checks if required ports are available

### Environment Setup
- **setup-env-testing.sh** (Linux/Mac) - Creates `.env.testing` files from templates
- **setup-env-testing.ps1** (Windows PowerShell) - Creates `.env.testing` files from templates

### Deployment
- **deploy-backend.sh** (Linux/Mac) - Deploys backend and database to server 172.28.92.57
- **deploy-backend.ps1** (Windows PowerShell) - Deploys backend and database to server 172.28.92.57
- **deploy-frontend.sh** (Linux/Mac) - Deploys frontend to server 172.28.92.56
- **deploy-frontend.ps1** (Windows PowerShell) - Deploys frontend to server 172.28.92.56

## Usage

### 1. Make Scripts Executable (Linux/Mac)
```bash
chmod +x scripts/*.sh
```

### 2. Check Ports
```bash
# Linux/Mac
./scripts/check-ports.sh

# Windows
.\scripts\check-ports.ps1
```

### 3. Setup Environment
```bash
# Linux/Mac
./scripts/setup-env-testing.sh

# Windows
.\scripts\setup-env-testing.ps1
```

### 4. Deploy
```bash
# Backend (on server 172.28.92.57)
./scripts/deploy-backend.sh

# Frontend (on server 172.28.92.56)
./scripts/deploy-frontend.sh
```

## Server Configuration

- **Frontend**: 172.28.92.56 (Public: 8.215.6.189)
- **Backend/DB**: 172.28.92.57

## Prerequisites

- Docker and Docker Compose installed
- SSH access to servers
- Network connectivity between servers
- Required ports available (80, 443, 6001, 5432)

## Notes

- All scripts use `--no-cache` to ensure fresh builds
- Scripts will stop and remove existing containers before deploying
- Database health checks are performed before starting backend
- Scripts include error handling and status checks

