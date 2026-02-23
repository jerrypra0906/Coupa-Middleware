# Deployment Script for Backend/DB Server (172.28.92.57) - PowerShell
# This script deploys the backend and database to the testing server

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Backend/DB Deployment Script" -ForegroundColor Cyan
Write-Host "Server: 172.28.92.57" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

Write-Host "Project root: $ProjectRoot" -ForegroundColor Green
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path "backend")) {
    Write-Host "Error: backend directory not found" -ForegroundColor Red
    exit 1
}

# Check if docker-compose.backend.yml exists
if (-not (Test-Path "docker-compose.backend.yml")) {
    Write-Host "Error: docker-compose.backend.yml not found" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml down 2>&1 | Out-Null

Write-Host ""
Write-Host "Step 2: Removing old containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml rm -f 2>&1 | Out-Null

Write-Host ""
Write-Host "Step 3: Building backend image..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml build --no-cache backend

Write-Host ""
Write-Host "Step 4: Starting database container..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml up -d db

Write-Host ""
Write-Host "Step 5: Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check database health
Write-Host "Checking database health..." -ForegroundColor Yellow
$dbReady = $false
for ($i = 1; $i -le 30; $i++) {
    $result = docker-compose -f docker-compose.backend.yml exec -T db pg_isready -U admincoupa -d coupa_middleware_staging 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database is ready!" -ForegroundColor Green
        $dbReady = $true
        break
    }
    if ($i -eq 30) {
        Write-Host "Warning: Database may not be ready yet. Continuing anyway..." -ForegroundColor Yellow
    } else {
        Write-Host "Waiting for database... ($i/30)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

Write-Host ""
Write-Host "Step 6: Starting backend container..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml up -d backend

Write-Host ""
Write-Host "Step 7: Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "Step 8: Checking container status..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml ps

Write-Host ""
Write-Host "Step 9: Checking logs..." -ForegroundColor Yellow
docker-compose -f docker-compose.backend.yml logs --tail 30 backend

Write-Host ""
Write-Host "Step 10: Testing health endpoint..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "http://localhost:6001/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend health check passed!" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Backend health check failed. Check logs for details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Backend API should be accessible at:"
Write-Host "  - http://172.28.92.57:6001" -ForegroundColor Green
Write-Host "  - Health check: http://172.28.92.57:6001/health" -ForegroundColor Green
Write-Host ""
Write-Host "Database is running on:"
Write-Host "  - Host: localhost (inside container network)"
Write-Host "  - Port: 5432 (mapped from container)"
Write-Host ""
Write-Host "To view logs:"
Write-Host "  - Backend: docker-compose -f docker-compose.backend.yml logs -f backend"
Write-Host "  - Database: docker-compose -f docker-compose.backend.yml logs -f db"
Write-Host ""
Write-Host "To stop: docker-compose -f docker-compose.backend.yml down"
Write-Host ""

