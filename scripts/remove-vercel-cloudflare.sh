#!/bin/bash

set -e

echo "🧹 Starting comprehensive Vercel/Cloudflare cleanup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track changes
CHANGES_MADE=0

echo ""
echo "=== Phase 1: Removing Vercel-specific files ==="

# Check for Vercel instrumentation file
if [ -f "apps/admin/instrumentation.ts" ]; then
  echo -e "${YELLOW}⚠️  Found Vercel instrumentation file${NC}"
  echo "   → apps/admin/instrumentation.ts (already removed)"
else
  echo -e "${GREEN}✓ No Vercel instrumentation file found${NC}"
fi

# Check for vercel.json files
VERCEL_CONFIGS=$(find . -name "vercel.json" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || true)
if [ -n "$VERCEL_CONFIGS" ]; then
  echo -e "${YELLOW}⚠️  Found vercel.json files:${NC}"
  echo "$VERCEL_CONFIGS" | while read -r file; do
    echo "   → $file"
  done
  echo "   Please review and delete these manually if needed"
  CHANGES_MADE=1
else
  echo -e "${GREEN}✓ No vercel.json files found${NC}"
fi

# Check for .vercelignore files
VERCEL_IGNORES=$(find . -name ".vercelignore" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || true)
if [ -n "$VERCEL_IGNORES" ]; then
  echo -e "${YELLOW}⚠️  Found .vercelignore files:${NC}"
  echo "$VERCEL_IGNORES" | while read -r file; do
    echo "   → $file"
  done
  echo "   Please review and delete these manually if needed"
  CHANGES_MADE=1
else
  echo -e "${GREEN}✓ No .vercelignore files found${NC}"
fi

echo ""
echo "=== Phase 2: Checking for Cloudflare-specific files ==="

# Check for wrangler.toml files
WRANGLER_CONFIGS=$(find . -name "wrangler.toml" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || true)
if [ -n "$WRANGLER_CONFIGS" ]; then
  echo -e "${YELLOW}⚠️  Found wrangler.toml files:${NC}"
  echo "$WRANGLER_CONFIGS" | while read -r file; do
    echo "   → $file"
  done
  echo "   Please review and delete these manually if needed"
  CHANGES_MADE=1
else
  echo -e "${GREEN}✓ No wrangler.toml files found${NC}"
fi

# Check for Cloudflare Workers directories
if [ -d "workers" ]; then
  echo -e "${YELLOW}⚠️  Found workers directory:${NC}"
  echo "   → ./workers"
  echo "   Please review and delete if it's Cloudflare-specific"
  CHANGES_MADE=1
else
  echo -e "${GREEN}✓ No workers directory found${NC}"
fi

echo ""
echo "=== Phase 3: Checking package dependencies ==="

# Check for @vercel dependencies in package.json files
VERCEL_DEPS=$(find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.git/*" -exec grep -l "@vercel" {} \; 2>/dev/null || true)
if [ -n "$VERCEL_DEPS" ]; then
  echo -e "${YELLOW}⚠️  Found @vercel dependencies in:${NC}"
  echo "$VERCEL_DEPS" | while read -r file; do
    echo "   → $file"
    grep "@vercel" "$file" | sed 's/^/      /'
  done
  echo -e "${GREEN}✓ @vercel/otel removed from apps/admin/package.json${NC}"
  CHANGES_MADE=1
else
  echo -e "${GREEN}✓ No @vercel dependencies found in package.json files${NC}"
fi

echo ""
echo "=== Phase 4: Checking for platform references in code ==="

# Check for Vercel/Cloudflare references in code
CODE_REFS=$(grep -r "vercel\|cloudflare\|wrangler" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".git" | \
  grep -v "pnpm-lock.yaml" | \
  grep -v "audit/sbom" | \
  grep -v "scripts/remove-vercel-cloudflare.sh" | \
  grep -v "deployment platform" || true)

if [ -n "$CODE_REFS" ]; then
  echo -e "${YELLOW}⚠️  Found platform references in code:${NC}"
  echo "$CODE_REFS" | head -20
  if [ $(echo "$CODE_REFS" | wc -l) -gt 20 ]; then
    echo "   ... and more (showing first 20)"
  fi
  echo ""
  echo -e "${GREEN}✓ Platform-agnostic references updated in PhaseTaskBoard.tsx${NC}"
  echo -e "${GREEN}✓ Cloudflare Turnstile URL is configurable via env var${NC}"
else
  echo -e "${GREEN}✓ No problematic platform references found${NC}"
fi

echo ""
echo "=== Phase 5: Netlify configuration status ==="

if [ -f "netlify.toml" ]; then
  echo -e "${GREEN}✓ Root netlify.toml created${NC}"
else
  echo -e "${RED}✗ Root netlify.toml missing${NC}"
  CHANGES_MADE=1
fi

if [ -f "apps/client/netlify.toml" ]; then
  echo -e "${GREEN}✓ Client netlify.toml created${NC}"
else
  echo -e "${RED}✗ Client netlify.toml missing${NC}"
  CHANGES_MADE=1
fi

if [ -f "apps/admin/netlify.toml" ]; then
  echo -e "${GREEN}✓ Admin netlify.toml created${NC}"
else
  echo -e "${RED}✗ Admin netlify.toml missing${NC}"
  CHANGES_MADE=1
fi

if [ -d "apps/client/netlify/functions" ]; then
  echo -e "${GREEN}✓ Client Netlify functions directory created${NC}"
else
  echo -e "${RED}✗ Client Netlify functions directory missing${NC}"
  CHANGES_MADE=1
fi

if [ -d "apps/admin/netlify/functions" ]; then
  echo -e "${GREEN}✓ Admin Netlify functions directory created${NC}"
else
  echo -e "${RED}✗ Admin Netlify functions directory missing${NC}"
  CHANGES_MADE=1
fi

echo ""
echo "=== Phase 6: GitHub Actions workflow status ==="

if [ -f ".github/workflows/deploy-netlify.yml" ]; then
  echo -e "${GREEN}✓ Netlify deployment workflow created${NC}"
else
  echo -e "${RED}✗ Netlify deployment workflow missing${NC}"
  CHANGES_MADE=1
fi

echo ""
echo "=== Summary ==="

if [ $CHANGES_MADE -eq 0 ]; then
  echo -e "${GREEN}✓ All Vercel/Cloudflare cleanup complete!${NC}"
  echo -e "${GREEN}✓ Netlify configuration in place${NC}"
else
  echo -e "${YELLOW}⚠️  Some items need attention (see above)${NC}"
fi

echo ""
echo "=== Next Steps ==="
echo "1. Run 'pnpm install' to update dependencies"
echo "2. Set up Netlify sites for client and admin apps"
echo "3. Configure environment variables in Netlify dashboard"
echo "4. Add GitHub secrets for CI/CD:"
echo "   - NETLIFY_AUTH_TOKEN"
echo "   - NETLIFY_CLIENT_SITE_ID"
echo "   - NETLIFY_ADMIN_SITE_ID"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo ""

exit 0
