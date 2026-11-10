#!/bin/bash

# SQL-Adapt Learning System - Quick Start Script
# Usage: ./scripts/dev-start.sh (run from the project root)
# Aligns with README.md Quick Start section

set -e

echo "🚀 Starting SQL-Adapt Learning System..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps/web" ]; then
    echo "❌ Error: Must run from project root directory"
    echo "   (where package.json and apps/web/ are located)"
    exit 1
fi

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo -e "${GREEN}  ✓ Dependencies installed${NC}"
fi

# Start Vite Dev Server (port 5173 as per README)
echo -e "${BLUE}▶ Starting development server...${NC}"
npm run dev &
DEV_PID=$!
echo -e "${GREEN}  ✓ Dev server started${NC}"

# Wait for server to be ready
echo -e "${BLUE}  Waiting for server...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Server ready${NC}"
        break
    fi
    sleep 0.5
done

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 SQL-Adapt is running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}📱 Web App:${NC}      http://localhost:5173"
echo -e "  ${BLUE}🎓 Student:${NC}      Practice SQL with hints"
echo -e "  ${BLUE}👨‍🏫 Instructor:${NC}   Passcode: TeachSQL2024"
echo ""
echo -e "  ${BLUE}🧪 Run Tests:${NC}    npm run test:e2e:weekly"
echo -e "  ${BLUE}📦 Build:${NC}        npm run build"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Keep script running
wait
