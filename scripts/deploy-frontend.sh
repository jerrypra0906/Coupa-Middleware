#!/bin/bash

# Deployment Script for Frontend Server (172.28.92.56)
# This script deploys the frontend application to the testing server

set -e  # Exit on error

echo "=========================================="
echo "Frontend Deployment Script"
echo "Server: 172.28.92.56 (Public: 8.215.6.189)"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

echo "Project root: $PROJECT_ROOT"
echo ""

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "Error: frontend directory not found"
    exit 1
fi

# Check if docker-compose.frontend.yml exists
if [ ! -f "docker-compose.frontend.yml" ]; then
    echo "Error: docker-compose.frontend.yml not found"
    exit 1
fi

echo "Step 1: Stopping existing containers..."
docker-compose -f docker-compose.frontend.yml down || true

echo ""
echo "Step 2: Removing old containers..."
docker-compose -f docker-compose.frontend.yml rm -f || true

echo ""
echo "Step 3: Building frontend image..."
docker-compose -f docker-compose.frontend.yml build --no-cache frontend

echo ""
echo "Step 4: Starting frontend container..."
docker-compose -f docker-compose.frontend.yml up -d frontend

echo ""
echo "Step 5: Checking container status..."
sleep 3
docker-compose -f docker-compose.frontend.yml ps

echo ""
echo "Step 6: Checking logs..."
docker-compose -f docker-compose.frontend.yml logs --tail 20 frontend

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Frontend should be accessible at:"
echo "  - Private IP: http://172.28.92.56"
echo "  - Public IP: http://8.215.6.189"
echo ""
echo "To view logs: docker-compose -f docker-compose.frontend.yml logs -f frontend"
echo "To stop: docker-compose -f docker-compose.frontend.yml down"
echo ""

