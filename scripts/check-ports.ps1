# Port Checking Script for Testing Server Deployment (PowerShell)
# This script checks if required ports are available on the server

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Port Availability Check for Testing Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if port is in use
function Check-Port {
    param(
        [int]$Port,
        [string]$Service
    )
    
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    
    if ($connection) {
        Write-Host "✗ Port $Port ($Service) is IN USE" -ForegroundColor Red
        $connection | Select-Object -First 1 | Format-Table LocalAddress, LocalPort, State, OwningProcess
        return $false
    } else {
        Write-Host "✓ Port $Port ($Service) is AVAILABLE" -ForegroundColor Green
        return $true
    }
}

# Check ports for Frontend Server (172.28.92.56)
Write-Host "FRONTEND SERVER (172.28.92.56 / 8.215.6.189)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Check-Port -Port 8080 -Service "HTTP (Frontend)"
Check-Port -Port 8443 -Service "HTTPS (Frontend)"
Write-Host ""

# Check ports for Backend/DB Server (172.28.92.57)
Write-Host "BACKEND/DB SERVER (172.28.92.57)" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Yellow
Check-Port -Port 6001 -Service "Backend API"
Check-Port -Port 5433 -Service "PostgreSQL Database"
Write-Host ""

# Summary
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Frontend Server needs: 8080, 8443"
Write-Host "Backend Server needs: 6001, 5433"
Write-Host ""
Write-Host "If any ports are in use, you may need to:" -ForegroundColor Yellow
Write-Host "1. Stop the service using that port"
Write-Host "2. Change the port in docker-compose configuration"
Write-Host "3. Configure firewall rules if needed"
Write-Host ""

