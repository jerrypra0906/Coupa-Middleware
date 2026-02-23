#!/bin/bash

# Port Checking Script for Testing Server Deployment
# This script checks if required ports are available on the server

echo "=========================================="
echo "Port Availability Check for Testing Server"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    local port=$1
    local service=$2
    
    if command -v netstat >/dev/null 2>&1; then
        # Linux
        if netstat -tuln | grep -q ":$port "; then
            echo -e "${RED}✗ Port $port ($service) is IN USE${NC}"
            netstat -tuln | grep ":$port " | head -1
            return 1
        else
            echo -e "${GREEN}✓ Port $port ($service) is AVAILABLE${NC}"
            return 0
        fi
    elif command -v ss >/dev/null 2>&1; then
        # Modern Linux (ss command)
        if ss -tuln | grep -q ":$port "; then
            echo -e "${RED}✗ Port $port ($service) is IN USE${NC}"
            ss -tuln | grep ":$port " | head -1
            return 1
        else
            echo -e "${GREEN}✓ Port $port ($service) is AVAILABLE${NC}"
            return 0
        fi
    elif command -v lsof >/dev/null 2>&1; then
        # macOS
        if lsof -i :$port >/dev/null 2>&1; then
            echo -e "${RED}✗ Port $port ($service) is IN USE${NC}"
            lsof -i :$port | head -2
            return 1
        else
            echo -e "${GREEN}✓ Port $port ($service) is AVAILABLE${NC}"
            return 0
        fi
    else
        echo -e "${YELLOW}⚠ Cannot check port $port - netstat/ss/lsof not available${NC}"
        return 2
    fi
}

# Check ports for Frontend Server (172.28.92.56)
echo "FRONTEND SERVER (172.28.92.56 / 8.215.6.189)"
echo "----------------------------------------"
check_port 80 "HTTP (Frontend)"
check_port 443 "HTTPS (Frontend)"
echo ""

# Check ports for Backend/DB Server (172.28.92.57)
echo "BACKEND/DB SERVER (172.28.92.57)"
echo "----------------------------------------"
check_port 6001 "Backend API"
check_port 5432 "PostgreSQL Database"
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Frontend Server needs: 80, 443"
echo "Backend Server needs: 6001, 5432"
echo ""
echo "If any ports are in use, you may need to:"
echo "1. Stop the service using that port"
echo "2. Change the port in docker-compose configuration"
echo "3. Configure firewall rules if needed"
echo ""

