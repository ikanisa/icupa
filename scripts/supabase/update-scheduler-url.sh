#!/usr/bin/env bash
set -euo pipefail

# Updates the scheduler_config key used by pg_cron to call menu/embed_items.
# Usage:
#   ./scripts/supabase/update-scheduler-url.sh --url https://<project>.functions.supabase.co/menu/embed_items [--project <ref>]

PROJECT_REF=""
TARGET_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_REF="$2"; shift 2 ;;
    --url)
      TARGET_URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TARGET_URL" ]]; then
  echo "Missing --url" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is not installed. Install via: npm i -g supabase" >&2
  exit 1
fi

SQL_FILE=$(mktemp)
trap 'rm -f "$SQL_FILE"' EXIT

cat > "$SQL_FILE" <<SQL
update public.scheduler_config
set value = '$TARGET_URL'
where key = 'menu_embed_items_url';
SQL

if [[ -n "$PROJECT_REF" ]]; then
  supabase db execute --file "$SQL_FILE" --project-ref "$PROJECT_REF"
else
  supabase db execute --file "$SQL_FILE"
fi

echo "✅ Updated scheduler_config.menu_embed_items_url"

