#!/bin/bash
# File: scripts/cleanup-deployment-configs.sh

set -e

echo "🧹 Starting complete Vercel/Cloudflare cleanup..."
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S') UTC"

# List of files and directories to remove
REMOVE_LIST=(
  "vercel.json"
  ".vercelignore"
  ".vercel/"
  "api/"
  "wrangler.toml"
  "cloudflare.json"
  "_worker.js"
  "_routes.json"
  "workers/"
  ".wrangler/"
  "functions/"
  ".next/"
  "next.config.js"
  "next-env.d.ts"
  "pages/api/"
)

# Remove files and directories
for item in "${REMOVE_LIST[@]}"; do
  if [ -e "$item" ]; then
    echo "Removing: $item"
    rm -rf "$item"
  fi
done

# Remove Vercel/Cloudflare packages
PACKAGES_TO_REMOVE=(
  "@vercel/analytics"
  "@vercel/edge"
  "@vercel/kv"
  "@vercel/node"
  "@vercel/postgres"
  "@cloudflare/workers-types"
  "@cloudflare/wrangler"
  "wrangler"
  "miniflare"
  "@cloudflare/pages-plugin-*"
  "vercel"
)

for package in "${PACKAGES_TO_REMOVE[@]}"; do
  echo "Removing package: $package"
  pnpm remove "$package" 2>/dev/null || true
done

# Clean package.json scripts
node -e "
const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const scriptsToRemove = [
  'vercel', 'vercel-build', 'vercel-dev', 'deploy:vercel',
  'wrangler', 'pages:build', 'pages:dev', 'pages:deploy',
  'workers:deploy', 'cf-*'
];

scriptsToRemove.forEach(script => delete packageJson.scripts[script]);
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Cleaned package.json scripts');
"

echo "✅ Cleanup complete at $(date -u '+%Y-%m-%d %H:%M:%S') UTC"
