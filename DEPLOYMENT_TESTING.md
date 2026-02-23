# Testing Server Deployment Guide

This guide provides instructions for deploying the Coupa Middleware application to the testing servers.

## Server Configuration

### Frontend Server
- **Private IP**: 172.28.92.56
- **Public IP**: 8.215.6.189
- **Services**: Frontend (React App)
- **Ports Required**: 80 (HTTP), 443 (HTTPS)

### Backend/DB Server
- **Private IP**: 172.28.92.57
- **Services**: Backend API, PostgreSQL Database
- **Ports Required**: 6001 (Backend API), 5432 (PostgreSQL)

## Prerequisites

1. **Docker and Docker Compose** installed on both servers
2. **Network connectivity** between servers (frontend can reach backend)
3. **Firewall rules** configured to allow required ports
4. **SSH access** to both servers
5. **Git** installed on servers (for pulling code from repository)

## Getting Code to Servers

### Option 1: Git Clone/Pull (Recommended)

1. **Push your code to GitHub/GitLab** (if not already done):
   ```bash
   git add .
   git commit -m "Add testing deployment configuration"
   git push origin main
   ```

2. **On each server, clone or pull the repository:**
   ```bash
   # If first time
   git clone <your-repository-url> /opt/coupa-middleware
   cd /opt/coupa-middleware
   
   # If repository already exists
   cd /opt/coupa-middleware
   git pull origin main
   ```

### Option 2: Direct File Copy (Alternative)

If you prefer not to use Git, you can copy files directly:

```bash
# From your local machine, use SCP to copy files
scp -r "D:\Cursor\Coupa Middleware\*" root@172.28.92.57:/opt/coupa-middleware/
scp -r "D:\Cursor\Coupa Middleware\*" root@172.28.92.56:/opt/coupa-middleware/
```

## Pre-Deployment Checklist

### 1. Check Port Availability

Before deploying, verify that required ports are available on each server.

#### Quick Manual Port Check (No Script Needed)

You can check ports manually using these commands:

**On Frontend Server (172.28.92.56):**
```bash
# Check if ports 80 and 443 are in use
netstat -tuln | grep -E ':(80|443) '
# or
ss -tuln | grep -E ':(80|443) '
# or
lsof -i :80 -i :443
```

**On Backend Server (172.28.92.57):**
```bash
# Check if ports 6001 and 5432 are in use
netstat -tuln | grep -E ':(6001|5432) '
# or
ss -tuln | grep -E ':(6001|5432) '
# or
lsof -i :6001 -i :5432
```

**If ports are available**, you'll see no output. **If ports are in use**, you'll see the process information.

#### Using the Port Check Script

After you have the code on the server, you can use the provided script:

```bash
# Make script executable
chmod +x scripts/check-ports.sh

# Run the script
./scripts/check-ports.sh
```

### 2. Verify Network Connectivity

From the frontend server, test connectivity to the backend:
```bash
# Test backend API
curl http://172.28.92.57:6001/health

# Test network connectivity
ping 172.28.92.57
telnet 172.28.92.57 6001
```

### 3. Prepare Environment Variables

After getting code to the server, setup environment files:

```bash
# Make script executable
chmod +x scripts/setup-env-testing.sh

# Run the script
./scripts/setup-env-testing.sh
```

Then update the following in `backend/.env.testing`:
- SAP credentials
- COUPA OAuth credentials
- SMTP credentials
- Security keys (JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY)

## Deployment Steps

### Step 1: Deploy Backend and Database

**On Backend Server (172.28.92.57):**

1. **Navigate to project directory:**
   ```bash
   cd /opt/coupa-middleware  # or wherever you cloned/copied the code
   ```

2. **Make deployment script executable:**
   ```bash
   chmod +x scripts/deploy-backend.sh
   ```

3. **Run the deployment script:**
   ```bash
   ./scripts/deploy-backend.sh
   ```

4. **Or manually deploy:**
   ```bash
   # Stop existing containers
   docker-compose -f docker-compose.backend.yml down

   # Build and start
   docker-compose -f docker-compose.backend.yml build --no-cache
   docker-compose -f docker-compose.backend.yml up -d

   # Check status
   docker-compose -f docker-compose.backend.yml ps
   docker-compose -f docker-compose.backend.yml logs -f
   ```

5. **Verify backend is running:**
   ```bash
   curl http://localhost:6001/health
   # Should return: {"status":"healthy","timestamp":"..."}
   ```

### Step 2: Deploy Frontend

**On Frontend Server (172.28.92.56):**

1. **Navigate to project directory:**
   ```bash
   cd /opt/coupa-middleware  # or wherever you cloned/copied the code
   ```

2. **Make deployment script executable:**
   ```bash
   chmod +x scripts/deploy-frontend.sh
   ```

3. **Run the deployment script:**
   ```bash
   ./scripts/deploy-frontend.sh
   ```

4. **Or manually deploy:**
   ```bash
   # Stop existing containers
   docker-compose -f docker-compose.frontend.yml down

   # Build and start
   docker-compose -f docker-compose.frontend.yml build --no-cache
   docker-compose -f docker-compose.frontend.yml up -d

   # Check status
   docker-compose -f docker-compose.frontend.yml ps
   docker-compose -f docker-compose.frontend.yml logs -f
   ```

5. **Verify frontend is accessible:**
   ```bash
   curl http://localhost
   # Should return HTML content
   ```

### Step 3: Verify Deployment

1. **Test Frontend Access:**
   - Private: http://172.28.92.56
   - Public: http://8.215.6.189

2. **Test Backend API:**
   - http://172.28.92.57:6001/health
   - http://172.28.92.57:6001/api

3. **Test Frontend-Backend Connection:**
   - Open frontend in browser
   - Check browser console for API connection errors
   - Try logging in (if authentication is configured)

## Configuration Files

### Frontend Configuration
- **File**: `docker-compose.frontend.yml`
- **API URL**: Configured to point to `http://172.28.92.57:6001/api`
- **Ports**: 80 (HTTP), 443 (HTTPS)

### Backend Configuration
- **File**: `docker-compose.backend.yml`
- **Database**: PostgreSQL on port 5432
- **API Port**: 6001
- **CORS**: Configured to allow requests from `http://172.28.92.56`

## Troubleshooting

### Port Already in Use

If a port is already in use:

1. **Find the process using the port:**
   ```bash
   # Linux
   sudo lsof -i :PORT
   # or
   sudo netstat -tulpn | grep :PORT
   ```

2. **Stop the process or change the port** in docker-compose file:
   ```yaml
   ports:
     - "NEW_PORT:CONTAINER_PORT"
   ```

### Backend Not Accessible from Frontend

1. **Check firewall rules:**
   ```bash
   # Linux
   sudo ufw status
   sudo ufw allow 6001/tcp
   ```

2. **Verify network connectivity:**
   ```bash
   # From frontend server
   ping 172.28.92.57
   telnet 172.28.92.57 6001
   ```

3. **Check CORS configuration** in `backend/src/index.js`:
   ```javascript
   origin: process.env.FRONTEND_URL || 'http://172.28.92.56'
   ```

### Database Connection Issues

1. **Check database container:**
   ```bash
   docker-compose -f docker-compose.backend.yml logs db
   docker-compose -f docker-compose.backend.yml exec db pg_isready -U admincoupa
   ```

2. **Verify database credentials** in `docker-compose.backend.yml`

3. **Check database volume:**
   ```bash
   docker volume ls
   docker volume inspect coupa-middleware_db_data
   ```

### Container Won't Start

1. **Check logs:**
   ```bash
   docker-compose -f docker-compose.backend.yml logs
   docker-compose -f docker-compose.frontend.yml logs
   ```

2. **Rebuild without cache:**
   ```bash
   docker-compose -f docker-compose.backend.yml build --no-cache
   ```

3. **Check Docker resources:**
   ```bash
   docker system df
   docker system prune  # Clean up if needed
   ```

## Maintenance

### Viewing Logs

```bash
# Backend logs
docker-compose -f docker-compose.backend.yml logs -f backend

# Database logs
docker-compose -f docker-compose.backend.yml logs -f db

# Frontend logs
docker-compose -f docker-compose.frontend.yml logs -f frontend
```

### Updating Application

1. **Pull latest code** from repository:
   ```bash
   git pull origin main
   ```

2. **Rebuild containers:**
   ```bash
   # Backend
   docker-compose -f docker-compose.backend.yml build --no-cache backend
   docker-compose -f docker-compose.backend.yml up -d backend

   # Frontend
   docker-compose -f docker-compose.frontend.yml build --no-cache frontend
   docker-compose -f docker-compose.frontend.yml up -d frontend
   ```

### Stopping Services

```bash
# Stop backend
docker-compose -f docker-compose.backend.yml down

# Stop frontend
docker-compose -f docker-compose.frontend.yml down
```

### Backup Database

```bash
# Create backup
docker-compose -f docker-compose.backend.yml exec db pg_dump -U admincoupa coupa_middleware_staging > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose -f docker-compose.backend.yml exec -T db psql -U admincoupa coupa_middleware_staging < backup_file.sql
```

## Security Considerations

1. **Change default passwords** in production
2. **Use HTTPS** for frontend (configure SSL certificates)
3. **Restrict database access** to backend server only
4. **Configure firewall rules** to limit access
5. **Use environment variables** for sensitive data
6. **Regular security updates** for Docker images

## Support

For issues or questions:
1. Check logs first: `docker-compose logs`
2. Verify network connectivity
3. Check port availability
4. Review configuration files
5. Contact the development team

---

**Last Updated**: 2025  
**Environment**: Testing  
**Servers**: 172.28.92.56 (Frontend), 172.28.92.57 (Backend/DB)
