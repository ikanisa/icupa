# AI Waiter Rollout Plan

## Feature flags

- `ai.waiter.enabled` – master switch for the text waiter (default off in production).
- `ai.waiter.voice.enabled` – enables the realtime voice surface (gated by readiness checklist).
- `ai.waiter.autonomy.level` – controls tool depth / guardrails (L0 – suggestion only, L1 – create order drafts, L2 – full autonomy).
- `ai.waiter.schema.v2` – toggles new tenant profile schema and prompt context.

Flags are stored in `agent_runtime_configs` (per-tenant overrides) and mirrored via environment variables for bootstrap defaults. Use the admin console or CLI (`pnpm flags:enable ...`) to adjust runtime configs during canaries. All changes are logged to `tenant_feature_audit` and should be recorded in `docs/runbooks/rollback-log.md`.

## Canary strategy

1. **Stage 0** – Internal QA (staging). Verify `/agents/waiter` and `/ai` route. Run Playwright suites and Supabase RLS tests.
2. **Stage 1 (10%)** – Enable `ai.waiter.enabled` + `ai.waiter.schema.v2` for two tenants (one EU, one RW). Monitor:
   - `agent_events` spending and latency
   - Allergen/age blocks (should be >0 if guests try restricted items)
   - Checkout completion rate vs. control
3. **Stage 2 (50%)** – Extend to additional venues once KPIs below meet thresholds for 48h. Ensure Supabase backfill metrics (`tenant_migration_audit`) remain stable.
4. **Stage 3 (100%)** – Enable globally after 7 days without critical incidents. Update RFC with rollout notes.

Roll back by toggling `ai.waiter.enabled=false` or lowering `ai.waiter.autonomy.level`.

## KPIs & dashboards

- **AOV lift** ≥ 8% compared to control tables.
- **Checkout success** ≥ 99.5%.
- **Allergen/age violations** = 0 (monitor guardrail blocks).
- **Hallucination rate** ≤ 0.5% (audited via sampled conversations + guardrail breach dashboard).
- **Latency** ≤ 2.5s p95 for text; ≤ 1.2s p95 per voice turn.

Dashboards should track tool depth, spend, allergen blocks, and conversion funnels. Tie alerts to `agent_events` aggregates (spend spikes, failure spikes).

## Kill switch & incident response

If KPIs regress or safety issues arise:
- Use the admin console or Supabase SQL to disable `ai.waiter.enabled`.
- Follow the escalation runbook `docs/runbooks/ai-kill-switch.md` for communication steps.
- Capture telemetry (trace IDs, agent events) for postmortem.

## Dependencies

- Agents service deployed with updated tools (v0.1.0 or later).
- Supabase migrations up to `20250315000000_menu_ingestion`.
- Client PWA running build that consumes `modules/diner`/`modules/agents-ui`.
- Telemetry exporter configured (OTEL endpoint).
