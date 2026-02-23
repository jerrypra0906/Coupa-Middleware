#!/bin/bash

# Deployment Script for Backend/DB Server (172.28.92.57)
# This script deploys the backend and database to the testing server

set -e  # Exit on error

echo "=========================================="
echo "Backend/DB Deployment Script"
echo "Server: 172.28.92.57"
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

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "Error: backend directory not found"
    exit 1
fi

# Check if docker-compose.backend.yml exists
if [ ! -f "docker-compose.backend.yml" ]; then
    echo "Error: docker-compose.backend.yml not found"
    exit 1
fi

echo "Step 1: Stopping existing containers..."
docker-compose -f docker-compose.backend.yml down || true

echo ""
echo "Step 2: Removing old containers..."
docker-compose -f docker-compose.backend.yml rm -f || true

echo ""
echo "Step 3: Building backend image..."
docker-compose -f docker-compose.backend.yml build --no-cache backend

echo ""
echo "Step 4: Starting database container..."
docker-compose -f docker-compose.backend.yml up -d db

echo ""
echo "Step 5: Waiting for database to be ready..."
sleep 10

# Check database health
echo "Checking database health..."
for i in {1..30}; do
    if docker-compose -f docker-compose.backend.yml exec -T db pg_isready -U admincoupa -d coupa_middleware_staging > /dev/null 2>&1; then
        echo "Database is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Warning: Database may not be ready yet. Continuing anyway..."
    else
        echo "Waiting for database... ($i/30)"
        sleep 2
    fi
done

echo ""
echo "Step 6: Starting backend container..."
docker-compose -f docker-compose.backend.yml up -d backend

echo ""
echo "Step 7: Waiting for backend to initialize..."
sleep 5

echo ""
echo "Step 8: Checking container status..."
docker-compose -f docker-compose.backend.yml ps

echo ""
echo "Step 9: Checking logs..."
docker-compose -f docker-compose.backend.yml logs --tail 30 backend

echo ""
echo "Step 10: Testing health endpoint..."
sleep 3
if curl -f http://localhost:6001/health > /dev/null 2>&1; then
    echo "✓ Backend health check passed!"
else
    echo "⚠ Backend health check failed. Check logs for details."
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Backend API should be accessible at:"
echo "  - http://172.28.92.57:6001"
echo "  - Health check: http://172.28.92.57:6001/health"
echo ""
echo "Database is running on:"
echo "  - Host: localhost (inside container network)"
echo "  - Port: 5432 (mapped from container)"
echo ""
echo "To view logs:"
echo "  - Backend: docker-compose -f docker-compose.backend.yml logs -f backend"
echo "  - Database: docker-compose -f docker-compose.backend.yml logs -f db"
echo ""
echo "To stop: docker-compose -f docker-compose.backend.yml down"
echo ""

