#!/bin/bash
# Production/Release Verification Script
# Compares repo state vs production deployment for SQL-Adapt

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROD_URL="https://adaptive-instructional-artifacts.vercel.app"
PROD_API_URL="https://adaptive-instructional-artifacts-ap.vercel.app"
PROBLEMS_FILE="apps/web/src/app/data/problems.ts"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Production Sync Verification Tool${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running from repo root
if [ ! -f "$PROBLEMS_FILE" ]; then
    echo -e "${RED}Error: Must run from repo root${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 REPO STATUS${NC}"
echo "------------------------------"

# Get repo SHA
if [ -d ".git" ]; then
    REPO_SHA=$(git rev-parse HEAD)
    REPO_SHA_SHORT=$(git rev-parse --short HEAD)
    echo -e "Git SHA: ${GREEN}$REPO_SHA${NC}"
    
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠️  Warning: Uncommitted changes detected${NC}"
        git status --short
    else
        echo -e "${GREEN}✓ Working tree clean${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Not a git repository${NC}"
    REPO_SHA="unknown"
fi

# Extract Query 13 expected value from repo
if [ -f "$PROBLEMS_FILE" ]; then
    QUERY13_REPO=$(grep -A 15 "id: 'problem-13'" "$PROBLEMS_FILE" | grep -o 'avg_price: [0-9.]*' | head -1 | grep -o '[0-9.]*')
    echo -e "Query 13 expected: ${GREEN}$QUERY13_REPO${NC}"
    
    # Calculate correct value
    # Electronics: (999.99 + 29.99 + 79.99) / 3 = 369.99
    CORRECT_VALUE="369.99"
    if [ "$QUERY13_REPO" = "$CORRECT_VALUE" ]; then
        echo -e "Query 13 validation: ${GREEN}✓ CORRECT${NC} (should be $CORRECT_VALUE)"
    else
        echo -e "Query 13 validation: ${RED}✗ WRONG${NC} (should be $CORRECT_VALUE, got $QUERY13_REPO)"
    fi
else
    echo -e "${RED}✗ Problems file not found${NC}"
    QUERY13_REPO="unknown"
fi

echo ""
echo -e "${YELLOW}🌐 PRODUCTION STATUS${NC}"
echo "------------------------------"

# Fetch production HTML to get the JS file being served
PROD_HTML=$(curl -s "$PROD_URL" 2>/dev/null || echo "")
if [ -z "$PROD_HTML" ]; then
    echo -e "${RED}✗ Failed to fetch production${NC}"
    exit 1
fi

# Extract JS filename from HTML
PROD_JS_FILE=$(echo "$PROD_HTML" | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1)
if [ -n "$PROD_JS_FILE" ]; then
    echo -e "Production JS: ${BLUE}$PROD_JS_FILE${NC}"
    
    # Fetch the JS and check Query 13 value
    PROD_JS_URL="$PROD_URL/assets/$PROD_JS_FILE"
    PROD_JS=$(curl -s "$PROD_JS_URL" 2>/dev/null || echo "")
    
    if [ -n "$PROD_JS" ]; then
        QUERY13_PROD=$(echo "$PROD_JS" | grep -o 'problem-13[^}]*avg_price:[0-9.]*' | grep -o 'avg_price:[0-9.]*' | cut -d: -f2)
        
        if [ -n "$QUERY13_PROD" ]; then
            echo -e "Query 13 expected: ${GREEN}$QUERY13_PROD${NC}"
            
            if [ "$QUERY13_PROD" = "$CORRECT_VALUE" ]; then
                echo -e "Query 13 validation: ${GREEN}✓ CORRECT${NC}"
            else
                echo -e "Query 13 validation: ${RED}✗ WRONG${NC} (should be $CORRECT_VALUE, got $QUERY13_PROD)"
            fi
        else
            echo -e "${YELLOW}⚠️  Could not extract Query 13 value from production${NC}"
            QUERY13_PROD="unknown"
        fi
        
        # Get cache status
        CACHE_STATUS=$(curl -sI "$PROD_URL" 2>/dev/null | grep -i 'x-vercel-cache' | tr -d '\r' || echo "unknown")
        echo -e "Cache status: ${BLUE}$CACHE_STATUS${NC}"
        
    else
        echo -e "${RED}✗ Failed to fetch production JS${NC}"
        QUERY13_PROD="unknown"
    fi
else
    echo -e "${YELLOW}⚠️  Could not determine production JS file${NC}"
    QUERY13_PROD="unknown"
fi

# Check backend API health
echo ""
echo -e "${YELLOW}🔌 BACKEND API STATUS${NC}"
echo "------------------------------"
API_HEALTH=$(curl -s "$PROD_API_URL" 2>/dev/null || echo "")
if echo "$API_HEALTH" | grep -q '"success":true'; then
    echo -e "Backend API: ${GREEN}✓ HEALTHY${NC}"
    echo -e "Response: ${BLUE}$(echo "$API_HEALTH" | grep -o '"service":"[^"]*"')${NC}"
else
    echo -e "Backend API: ${RED}✗ UNHEALTHY${NC}"
fi

echo ""
echo -e "${YELLOW}📊 GAP ANALYSIS${NC}"
echo "------------------------------"

if [ "$QUERY13_REPO" = "$QUERY13_PROD" ] && [ "$QUERY13_REPO" = "$CORRECT_VALUE" ]; then
    echo -e "${GREEN}✓ Repo and Production are in sync and CORRECT${NC}"
    echo -e "${GREEN}✓ Query 13 has correct expected value: $CORRECT_VALUE${NC}"
    SYNC_STATUS="synced"
elif [ "$QUERY13_REPO" = "$CORRECT_VALUE" ] && [ "$QUERY13_PROD" != "$CORRECT_VALUE" ]; then
    echo -e "${RED}✗ Repo is correct but Production is stale${NC}"
    echo -e "  Repo: $QUERY13_REPO"
    echo -e "  Prod: $QUERY13_PROD"
    SYNC_STATUS="stale"
elif [ "$QUERY13_REPO" != "$CORRECT_VALUE" ]; then
    echo -e "${RED}✗ Repo has incorrect value${NC}"
    echo -e "  Expected: $CORRECT_VALUE"
    echo -e "  Got: $QUERY13_REPO"
    SYNC_STATUS="repo-error"
else
    echo -e "${YELLOW}⚠️  Status unclear${NC}"
    SYNC_STATUS="unknown"
fi

echo ""
echo -e "${YELLOW}💡 RECOMMENDATION${NC}"
echo "------------------------------"
case $SYNC_STATUS in
    synced)
        echo -e "${GREEN}✓ No action needed - everything is correct!${NC}"
        ;;
    stale)
        echo -e "${YELLOW}⚠️  Production is stale. Recommend:${NC}"
        echo "   1. Run: npm run build"
        echo "   2. Deploy to Vercel: vercel --prod"
        echo "   3. Re-run this script to verify"
        ;;
    repo-error)
        echo -e "${RED}✗ Fix repo first:${NC}"
        echo "   1. Update $PROBLEMS_FILE"
        echo "   2. Set Query 13 avg_price to $CORRECT_VALUE"
        echo "   3. Commit and rebuild"
        ;;
    *)
        echo -e "${YELLOW}⚠️  Manual investigation needed${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Verification Complete${NC}"
echo -e "${BLUE}========================================${NC}"
