#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_FILE=${1:-ci.yml}
REPO=${GITHUB_REPOSITORY:-icupa/icupa}
QUERY_PARAMS=("per_page=100")

if [[ ${2:-} != "" ]]; then
  QUERY_PARAMS+=("status=${2}")
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required to export workflow metrics" >&2
  exit 1
fi

# Fetch workflow runs and emit JSON objects with duration metadata for downstream dashboards.
gh api \
  repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs \
  --paginate \
  $(printf -- '--field %s ' "${QUERY_PARAMS[@]}") \
  --jq '.workflow_runs[] | {id, status, conclusion, event, created_at, updated_at, run_attempt, run_number, duration_seconds: ((.updated_at | fromdateiso8601) - (.created_at | fromdateiso8601))}'
