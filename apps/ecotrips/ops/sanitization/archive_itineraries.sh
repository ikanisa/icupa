#!/usr/bin/env bash
set -euo pipefail
shopt -s extglob

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIRM_FILE="$ROOT_DIR/sanitization/CONFIRM_ARCHIVE.txt"
ID_FILE="$ROOT_DIR/sanitization/itinerary_ids.txt"

if [[ ! -f "$CONFIRM_FILE" || ! -f "$ID_FILE" ]]; then
  echo "Required files are missing (CONFIRM_ARCHIVE.txt or itinerary_ids.txt)." >&2
  exit 1
fi

if [[ "$(tr -d '\r\n' < "$CONFIRM_FILE" | xargs)" != "APPROVED" ]]; then
  echo "Archive aborted: CONFIRM_ARCHIVE.txt is not set to APPROVED." >&2
  exit 1
fi

RAW_IDS=()
while IFS= read -r line; do
  line="${line%%#*}" # strip comments
  line="${line//$'\r'/}" # remove carriage returns
  line="${line##+([[:space:]])}" # trim leading whitespace (bash extglob needed)
  line="${line%%+([[:space:]])}" # trim trailing whitespace
  if [[ -n "$line" ]]; then
    RAW_IDS+=("$line")
  fi
done < "$ID_FILE"

if [[ ${#RAW_IDS[@]} -eq 0 ]]; then
  echo "Archive aborted: no itinerary IDs provided." >&2
  exit 1
fi

UUID_PATTERN='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
for uuid in "${RAW_IDS[@]}"; do
  if [[ ! $uuid =~ $UUID_PATTERN ]]; then
    echo "Archive aborted: invalid UUID detected -> $uuid" >&2
    exit 1
  fi
done

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Archive aborted: SUPABASE_DB_URL environment variable is required." >&2
  exit 1
fi

ARRAY_CONTENT=$(printf "'%s'," "${RAW_IDS[@]}")
ARRAY_CONTENT="${ARRAY_CONTENT%,}"
SQL="select booking.archive_itineraries(ARRAY[${ARRAY_CONTENT}]::uuid[]);"

echo "Running archive for ${#RAW_IDS[@]} itinerary(ies)..."
psql "$SUPABASE_DB_URL" -c "$SQL"
