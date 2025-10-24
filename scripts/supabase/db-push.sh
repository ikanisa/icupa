#!/usr/bin/env bash
set -euo pipefail

# Pushes local migrations to a remote Supabase project.
# Usage:
#   ./scripts/supabase/db-push.sh --project <ref>

PROJECT_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_REF="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_REF" ]]; then
  echo "Missing --project <ref>" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed. Run 'npm install' in the repo or use 'npx supabase@latest'." >&2
  exit 1
fi

node "$(dirname "$0")/validate-migrations.mjs"

supabase db push --project-ref "$PROJECT_REF"
echo "✅ Remote migrations applied to $PROJECT_REF"

