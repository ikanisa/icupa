#!/usr/bin/env bash
set -euo pipefail

# Runs web app (Vite), agents service, and OCR converter together.
# Usage:
#   ./scripts/dev/dev-all.sh

PIDS=()

function start() {
  local name="$1"; shift
  echo "▶ Starting $name: $*"
  ("$@" &) 
  PIDS+=("$!")
}

function cleanup() {
  echo "\n⏹ Stopping services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

trap cleanup EXIT INT TERM

# Start services
start "web" npm run dev
start "agents" npm run dev:agents
start "ocr-converter" npm run dev:ocr:converter

echo "\nAll services started. Press Ctrl+C to stop.\n"
wait -n || true

