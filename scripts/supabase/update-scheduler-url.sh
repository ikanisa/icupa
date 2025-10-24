#!/usr/bin/env bash
set -euo pipefail

# Updates the scheduler_config key used by pg_cron to call menu/embed_items.
# Usage:
#   ./scripts/supabase/update-scheduler-url.sh --url https://<project>.functions.supabase.co/menu/embed_items [--db-url <postgres://...>]
# For convenience, omitting --db-url defaults to the local Supabase stack (postgresql://postgres:postgres@127.0.0.1:54322/postgres).

TARGET_URL=""
DB_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      TARGET_URL="$2"; shift 2 ;;
    --db-url)
      DB_URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TARGET_URL" ]]; then
  echo "Missing --url" >&2
  exit 1
fi

if [[ -z "$DB_URL" ]]; then
  DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed. Install via: brew install libpq (macOS) or your distro package manager." >&2
  exit 1
fi

SQL_FILE=$(mktemp)
trap 'rm -f "$SQL_FILE"' EXIT

cat > "$SQL_FILE" <<SQL
update public.scheduler_config
set value = '$TARGET_URL'
where key = 'menu_embed_items_url';
SQL

psql "$DB_URL" -f "$SQL_FILE"

echo "✅ Updated scheduler_config.menu_embed_items_url"
