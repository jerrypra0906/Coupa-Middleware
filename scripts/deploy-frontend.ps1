# Deployment Script for Frontend Server (172.28.92.56) - PowerShell
# This script deploys the frontend application to the testing server

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Frontend Deployment Script" -ForegroundColor Cyan
Write-Host "Server: 172.28.92.56 (Public: 8.215.6.189)" -ForegroundColor Cyan
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

# Check if frontend directory exists
if (-not (Test-Path "frontend")) {
    Write-Host "Error: frontend directory not found" -ForegroundColor Red
    exit 1
}

# Check if docker-compose.frontend.yml exists
if (-not (Test-Path "docker-compose.frontend.yml")) {
    Write-Host "Error: docker-compose.frontend.yml not found" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.frontend.yml down 2>&1 | Out-Null

Write-Host ""
Write-Host "Step 2: Removing old containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.frontend.yml rm -f 2>&1 | Out-Null

Write-Host ""
Write-Host "Step 3: Building frontend image..." -ForegroundColor Yellow
docker-compose -f docker-compose.frontend.yml build --no-cache frontend

Write-Host ""
Write-Host "Step 4: Starting frontend container..." -ForegroundColor Yellow
docker-compose -f docker-compose.frontend.yml up -d frontend

Write-Host ""
Write-Host "Step 5: Checking container status..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
docker-compose -f docker-compose.frontend.yml ps

Write-Host ""
Write-Host "Step 6: Checking logs..." -ForegroundColor Yellow
docker-compose -f docker-compose.frontend.yml logs --tail 20 frontend

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Frontend should be accessible at:"
Write-Host "  - Private IP: http://172.28.92.56" -ForegroundColor Green
Write-Host "  - Public IP: http://8.215.6.189" -ForegroundColor Green
Write-Host ""
Write-Host "To view logs: docker-compose -f docker-compose.frontend.yml logs -f frontend"
Write-Host "To stop: docker-compose -f docker-compose.frontend.yml down"
Write-Host ""

