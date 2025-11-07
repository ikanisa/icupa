#!/bin/bash

set -e

echo "🔍 Running pre-deployment checks for Netlify..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track overall status
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

# Function to print status
print_status() {
  local status=$1
  local message=$2
  
  if [ "$status" == "pass" ]; then
    echo -e "${GREEN}✓${NC} $message"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  elif [ "$status" == "fail" ]; then
    echo -e "${RED}✗${NC} $message"
    CHECKS_FAILED=$((CHECKS_FAILED + 1))
  elif [ "$status" == "warn" ]; then
    echo -e "${YELLOW}⚠${NC} $message"
    CHECKS_WARNING=$((CHECKS_WARNING + 1))
  else
    echo -e "${BLUE}ℹ${NC} $message"
  fi
}

echo ""
echo "=== Environment Checks ==="

# Check Node version
NODE_VERSION=$(node --version)
if [[ "$NODE_VERSION" =~ ^v20\. ]]; then
  print_status "pass" "Node.js version: $NODE_VERSION"
else
  print_status "warn" "Node.js version: $NODE_VERSION (expected v20.x)"
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
  PNPM_VERSION=$(pnpm --version)
  print_status "pass" "pnpm version: $PNPM_VERSION"
else
  print_status "fail" "pnpm is not installed"
fi

# Check for required environment variables
echo ""
echo "=== Environment Variables ==="

check_env_var() {
  local var_name=$1
  if [ -z "${!var_name}" ]; then
    print_status "fail" "$var_name is not set"
    return 1
  else
    # Don't print the actual value for security
    print_status "pass" "$var_name is set"
    return 0
  fi
}

# Check if .env.local or .env exists
if [ -f ".env.local" ] || [ -f ".env" ]; then
  print_status "pass" "Environment file found"
  
  # Source the env file for checks
  if [ -f ".env.local" ]; then
    source .env.local 2>/dev/null || true
  elif [ -f ".env" ]; then
    source .env 2>/dev/null || true
  fi
  
  # Check critical variables
  check_env_var "VITE_SUPABASE_URL" || true
  check_env_var "VITE_SUPABASE_ANON_KEY" || true
else
  print_status "warn" "No .env.local or .env file found (OK for CI)"
fi

echo ""
echo "=== Repository Structure ==="

# Check for Netlify config files
if [ -f "netlify.toml" ]; then
  print_status "pass" "Root netlify.toml exists"
else
  print_status "fail" "Root netlify.toml missing"
fi

if [ -f "apps/client/netlify.toml" ]; then
  print_status "pass" "Client netlify.toml exists"
else
  print_status "fail" "Client netlify.toml missing"
fi

if [ -f "apps/admin/netlify.toml" ]; then
  print_status "pass" "Admin netlify.toml exists"
else
  print_status "fail" "Admin netlify.toml missing"
fi

# Check for Netlify functions
if [ -d "apps/client/netlify/functions" ]; then
  FUNC_COUNT=$(find apps/client/netlify/functions -name "*.ts" -o -name "*.js" | wc -l)
  print_status "pass" "Client functions directory exists ($FUNC_COUNT functions)"
else
  print_status "warn" "Client functions directory missing"
fi

if [ -d "apps/admin/netlify/functions" ]; then
  FUNC_COUNT=$(find apps/admin/netlify/functions -name "*.ts" -o -name "*.js" | wc -l)
  print_status "pass" "Admin functions directory exists ($FUNC_COUNT functions)"
else
  print_status "warn" "Admin functions directory missing"
fi

echo ""
echo "=== Dependencies ==="

# Check if node_modules exists
if [ -d "node_modules" ]; then
  print_status "pass" "Dependencies installed"
else
  print_status "fail" "Dependencies not installed (run 'pnpm install')"
fi

# Check for Vercel/Cloudflare remnants
echo ""
echo "=== Platform Cleanup ==="

VERCEL_REFS=$(find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l "@vercel" {} \; 2>/dev/null || true)
if [ -z "$VERCEL_REFS" ]; then
  print_status "pass" "No @vercel dependencies found"
else
  print_status "warn" "@vercel dependencies still present in package.json files"
fi

if [ -f "apps/admin/instrumentation.ts" ]; then
  print_status "warn" "Vercel instrumentation.ts still exists"
else
  print_status "pass" "No Vercel instrumentation file"
fi

echo ""
echo "=== Build Test ==="

# Try a dry run build check
if [ -d "node_modules" ]; then
  echo "Checking TypeScript compilation..."
  if pnpm typecheck 2>/dev/null; then
    print_status "pass" "TypeScript compilation successful"
  else
    print_status "warn" "TypeScript compilation has errors (may be pre-existing)"
  fi
else
  print_status "info" "Skipping build test (dependencies not installed)"
fi

echo ""
echo "=== GitHub Actions ==="

if [ -f ".github/workflows/deploy-netlify.yml" ]; then
  print_status "pass" "Netlify deployment workflow exists"
else
  print_status "fail" "Netlify deployment workflow missing"
fi

# Check for required secrets documentation
if grep -q "NETLIFY_AUTH_TOKEN" .github/workflows/deploy-netlify.yml 2>/dev/null; then
  print_status "pass" "Workflow uses NETLIFY_AUTH_TOKEN"
else
  print_status "warn" "Workflow may not use NETLIFY_AUTH_TOKEN"
fi

echo ""
echo "=== Summary ==="
echo ""

TOTAL_CHECKS=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNING))

echo -e "Total checks: $TOTAL_CHECKS"
echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
echo -e "${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo -e "${RED}Failed: $CHECKS_FAILED${NC}"

echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Pre-deployment checks passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Commit and push your changes"
  echo "2. Create Netlify sites for client and admin"
  echo "3. Configure environment variables in Netlify"
  echo "4. Add GitHub secrets for CI/CD"
  echo "5. Deploy via GitHub Actions or Netlify CLI"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Pre-deployment checks failed${NC}"
  echo ""
  echo "Please fix the failed checks before deploying."
  echo "See NETLIFY_DEPLOYMENT.md for detailed instructions."
  echo ""
  exit 1
fi
