# ecoTrips Agent Platform

## Overview
The ecoTrips agent fleet uses OpenAI Agents SDK for planning, booking, support, and operations across WhatsApp (primary) with voice planned via OpenAI Realtime. Each agent maps to Supabase Edge Functions for deterministic tool execution and writes observability breadcrumbs through OpenTelemetry traces plus `AUDIT` logs.

## Tool Invocation
- Agents call tools defined in `tools/registry.yaml` using structured JSON payloads that align with each function's schema.
- Authentication: traveler-facing actions use user JWT + anon key headers; ops/finance/safety use service-role secrets managed in Supabase function secrets.
- Idempotency: planner/checkout calls must supply `idempotency_key`; refunds/payouts require dual control and audit logging.

## Memory Model
- **short_term**: last 40 turns buffered per session to maintain conversational context.
- **working_plan**: JSON itinerary scratchpad shared across Planner and Concierge; flushed 48h after inactivity.
- **long_term**: pgvector embeddings keyed by user_id + tags (`places_liked`, `pace`, `diet`, `language`, `issues`). Refreshed nightly with consent.
- **team_memory**: curated ops/finops learnings (supplier performance, refund causes, policy updates) with governance by ops review.

## Evaluations
- Nightly job reads `agents/evals/baseline.jsonl`, replays prompts via Agents SDK, and compares JSON outputs against `expected` fields.
- Pass criteria: structural schema match and semantic checks (budget caps, daylight hours, escalation flags).
- Failures open exceptions in Supabase (`ops.exceptions`) and page the on-call via notify agent (future).

## Rollout Strategy
- Feature flags per agent (`planner_v1`, `concierge_beta`, etc.) stored in Supabase config table.
- Error budgets: Planner (<2% tool error), Concierge (<3% late handoffs), Support (<5% reopen).
- On-call rotation receives OTEL alerts for `ERROR` spans over 5/min threshold; fallback to manual WhatsApp broadcast if automation paused.

## Next Steps
1. Implement remaining stubs (`map.route`, `map.nearby`, `notify.whatsapp_send`) as Edge Functions.
2. Add automated embedding hygiene (GDPR delete map + TTL enforcement).
3. Expand eval pack with regression cases once new agents roll out.

## Orchestrator v1
- Endpoint: `POST https://woyknezboamabahknmjr.supabase.co/functions/v1/agent-orchestrator`
- Request body
  ```json
  {
    "agent": "PlannerCoPilot",
    "session_id": "optional-uuid",
    "user_id": "optional-uuid",
    "goal": "free-form narrative",
    "plan": { "days": [] },
    "tool_call": { "key": "quote.search", "input": { "destination": "Kigali" } },
    "dry_run": true
  }
  ```
- Dry-run mode (`dry_run=true`) returns the resolved tool endpoint/method without executing it and skips external side effects.
- Live mode triggers the mapped Edge Function, forwarding status + JSON body in `tool_result`.
- Memory scopes touched: `working_plan` is merged for every request when `plan` is provided; future iterations may persist short-term chat transcripts.
- Memory scopes touched: `working_plan` is merged for every request when `plan` is provided; `short_term` appends recent `messages` entries (bounded to 40 turns, newest retained).
- Every invocation writes an `agents.events` row (`level=AUDIT`, `event=agent.tool_call`) with a redacted payload `{ agent, tool, requestId, dryRun }`.
- Sessions auto-provision when `session_id` is omitted; pass `user_id` to bind ownership for RLS.
- Rate limiting TBD: plan to enforce per-agent + per-user caps once orchestrator is public.

## Runtime Maintenance
- Cleanup endpoint: `POST https://woyknezboamabahknmjr.supabase.co/functions/v1/agent-runtime-maintenance`
  ```json
  {
    "session_days": 30,
    "event_days": 30
  }
  ```
- Removes `agents.events` older than `event_days` and prunes `agents.sessions` (with cascading memory) older than `session_days`.
- Defaults: 30 days for both if omitted (capped at 365).
- Use service-role auth; schedule via cron/Task Scheduler to keep agent storage lean.

## Learning Loop v1
- **Run evaluations manually**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/agents-eval-runner" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -d '{"label":"smoke","limit":3}'
  ```
- **Read reports**
  ```sh
  curl -s "https://woyknezboamabahknmjr.supabase.co/functions/v1/agents-eval-report?run_id=<uuid>" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  ```
- Nightly scheduling (future): invoke `agents-eval-runner` with labels like `nightly-YYYY-MM-DD`; capture `run_id` for follow-up. No scheduler automation yet.
- Review failures via the report’s `top_failures`, then update `agents/evals/baseline.jsonl` with new or refined cases.

## Privacy & Memory Hygiene
- All agent storage tables are listed in `privacy.data_map`; erasure requests automatically redact WhatsApp payloads (`agents.messages.body`, `user_wa`).
- The GDPR pipeline scrubs `agents.sessions` / `agents.state` for the subject user via the redaction rules documented in `ops/privacy/ERASURE_POLICY.md`.
- When testing locally, rerun `privacy-erasure-dryrun` followed by `privacy-erasure-execute` to ensure conversational memory is purged for the user under review.
