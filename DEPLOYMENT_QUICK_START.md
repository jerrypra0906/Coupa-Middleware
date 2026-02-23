# Quick Start - Testing Server Deployment

## Server Information

- **Frontend Server**: 172.28.92.56 (Public: 8.215.6.189)
- **Backend/DB Server**: 172.28.92.57

## Quick Deployment Steps

### 1. Check Ports (Both Servers)

```bash
# Linux
./scripts/check-ports.sh

# Windows PowerShell
.\scripts\check-ports.ps1
```

### 2. Setup Environment Files

```bash
# Linux
chmod +x scripts/setup-env-testing.sh
./scripts/setup-env-testing.sh

# Windows PowerShell
.\scripts\setu p-env-testing.ps1
```

**Then edit** `backend/.env.testing` with your actual credentials.

### 3. Deploy Backend (Server: 172.28.92.57)

```bash
# Linux
chmod +x scripts/deploy-backend.sh
./scripts/deploy-backend.sh

# Windows PowerShell
.\scripts\deploy-backend.ps1
```

### 4. Deploy Frontend (Server: 172.28.92.56)

```bash
# Linux
chmod +x scripts/deploy-frontend.sh
./scripts/deploy-frontend.sh

# Windows PowerShell
.\scripts\deploy-frontend.ps1
```

### 5. Verify

- Frontend: http://172.28.92.56 or http://8.215.6.189
- Backend Health: http://172.28.92.57:6001/health
- Backend API: http://172.28.92.57:6001/api

## Required Ports

### Frontend Server (172.28.92.56)
- **80** - HTTP
- **443** - HTTPS

### Backend Server (172.28.92.57)
- **6001** - Backend API
- **5432** - PostgreSQL Database

## Troubleshooting

### Port in Use?
```bash
# Find process
sudo lsof -i :PORT
# Kill process (if safe)
sudo kill -9 PID
```

### Can't Connect Frontend to Backend?
1. Check firewall: `sudo ufw status`
2. Test connectivity: `curl http://172.28.92.57:6001/health`
3. Check CORS in backend config

### Container Won't Start?
```bash
# Check logs
docker-compose -f docker-compose.backend.yml logs
docker-compose -f docker-compose.frontend.yml logs

# Rebuild
docker-compose -f docker-compose.backend.yml build --no-cache
```

## Full Documentation

See [DEPLOYMENT_TESTING.md](./DEPLOYMENT_TESTING.md) for detailed instructions.

