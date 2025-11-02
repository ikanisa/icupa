#!/usr/bin/env bash
set -euo pipefail

URL="${1:-}"
TIMEOUT="${2:-60}"

if [[ -z "$URL" ]]; then
  echo "Usage: wait-for-service.sh <url> [timeout]" >&2
  exit 1
fi

end=$((SECONDS + TIMEOUT))

until [[ $SECONDS -ge $end ]]; do
  if curl -fsSL "$URL" >/dev/null 2>&1; then
    echo "Service at $URL is reachable"
    exit 0
  fi
  sleep 5
  echo "Waiting for $URL ..."
done

echo "Timed out waiting for $URL after ${TIMEOUT}s" >&2
exit 1
