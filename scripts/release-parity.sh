#!/bin/bash
# Release Parity Check Script
# Shows current repo state vs production deployments

set -e

echo "========================================="
echo "Release Parity Check"
echo "========================================="
echo ""

# Repo SHA
REPO_SHA=$(git rev-parse HEAD)
REPO_BRANCH=$(git branch --show-current)
echo "📁 REPO STATE"
echo "   Branch: $REPO_BRANCH"
echo "   Commit: $REPO_SHA"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  WARNING: Uncommitted changes detected"
    git status --short
    echo ""
fi

# Expected production SHAs (update these after each deploy)
EXPECTED_FRONTEND_PROD="fd64dd86d9e25b24ddf5d7f87913693c6e1905e9"
EXPECTED_BACKEND_PROD="fd64dd86d9e25b24ddf5d7f87913693c6e1905e9"

echo "🚀 PRODUCTION STATE (last known)"
echo "   Frontend: $EXPECTED_FRONTEND_PROD"
echo "   Backend:  $EXPECTED_BACKEND_PROD"
echo ""

# Check drift
echo "🔍 DRIFT ANALYSIS"
if [ "$REPO_SHA" = "$EXPECTED_FRONTEND_PROD" ]; then
    echo "   Frontend: ✅ In sync"
else
    echo "   Frontend: ⚠️  DRIFT DETECTED"
    COMMITS_AHEAD=$(git rev-list --count "$EXPECTED_FRONTEND_PROD..$REPO_SHA" 2>/dev/null || echo "?")
    echo "             Repo is $COMMITS_AHEAD commit(s) ahead of production"
fi

if [ "$REPO_SHA" = "$EXPECTED_BACKEND_PROD" ]; then
    echo "   Backend:  ✅ In sync"
else
    echo "   Backend:  ⚠️  DRIFT DETECTED"
    COMMITS_AHEAD=$(git rev-list --count "$EXPECTED_BACKEND_PROD..$REPO_SHA" 2>/dev/null || echo "?")
    echo "             Repo is $COMMITS_AHEAD commit(s) ahead of production"
fi
echo ""

# Package version
echo "📦 PROJECT VERSION"
node -p "require('./package.json').version" 2>/dev/null || echo "   (could not read)"
echo ""

# Node version
echo "🟢 NODE VERSION"
echo "   Current: $(node --version)"
echo "   Required: $(cat package.json | grep '"node"' | head -1 | cut -d'"' -f4 || echo 'not specified')"
echo ""

# Build status check (optional, can be slow)
if [ "$1" = "--with-build" ]; then
    echo "🔨 BUILD CHECK (this may take a moment)..."
    if npm run server:build > /tmp/build-server.log 2>&1; then
        echo "   Server build: ✅ PASS"
    else
        echo "   Server build: ❌ FAIL (see /tmp/build-server.log)"
    fi
    
    if npm run build > /tmp/build-web.log 2>&1; then
        echo "   Web build:    ✅ PASS"
    else
        echo "   Web build:    ❌ FAIL (see /tmp/build-web.log)"
    fi
    echo ""
fi

echo "========================================="
echo "For full audit checklist, see:"
echo "   docs/audit/runtime-audit-checklist-2026-04-08.md"
echo "========================================="
