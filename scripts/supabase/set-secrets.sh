#!/usr/bin/env bash
set -euo pipefail

# Loads secrets from an env file and sets them in the Supabase project.
# Usage:
#   ./scripts/supabase/set-secrets.sh [--project <ref>] [--env-file .env.supabase]

ENV_FILE=".env.supabase"
PROJECT_REF=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_REF="$2"; shift 2 ;;
    --env-file)
      ENV_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed. Run 'npm install' in the repo or use 'npx supabase@latest'." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

# Read non-comment, non-empty lines, strip CRLF and optional leading 'export '
mapfile -t pairs < <(sed -e 's/\r$//' -e 's/^export\s\+//' "$ENV_FILE" | grep -v '^[[:space:]]*#' | awk 'NF')

if [[ ${#pairs[@]} -eq 0 ]]; then
  echo "No secrets found in $ENV_FILE"
  exit 0
fi

ARGS=(secrets set)
if [[ -n "$PROJECT_REF" ]]; then
  ARGS+=("--project-ref" "$PROJECT_REF")
fi

# Do not echo secrets; pass as arguments
supabase "${ARGS[@]}" "${pairs[@]}"

echo "✅ Set ${#pairs[@]} secrets from $ENV_FILE"

