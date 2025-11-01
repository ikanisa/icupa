# Observability & SRE Plan

## Current Signals
- Agents service depends on OTEL SDK but no exporters configured in code.
- Supabase edge functions log to console without correlation IDs or structured JSON.
- PWAs lack browser performance monitoring or error boundary telemetry.

## Target Architecture
1. **Tracing**
   - Use OpenTelemetry JS for PWAs to instrument fetch calls to Supabase, injecting `traceparent` header.
   - Extend agents service to export OTLP traces to collector (e.g., OTEL Collector + Honeycomb/Grafana Tempo).
   - Propagate trace IDs through Supabase function headers and include in logs.
2. **Logging**
   - Adopt pino or Winston with JSON output for Node services; Deno functions log JSON with `tenant_id`, `user_id`, `request_id`.
   - Centralize logs in ELK or OpenSearch with retention policy (90 days standard, 1 year for audit tables).
3. **Metrics**
   - Publish Prometheus metrics from agents service (`latency_ms`, `openai_tokens`, `budget_remaining`).
   - Add Supabase cron metrics (job success/failure) via scheduled function writing to metrics table.
   - Browser metrics: Web Vitals via `web-vitals` package to analytics backend.
4. **Health Checks**
   - `/healthz` route in agents service verifying Supabase + OpenAI + queue.
   - Supabase `ops/db_health` already returns status—hook into uptime monitor.
5. **Alerting & SLOs**
   - Define SLOs: OTP success >= 99%, Agent response latency P95 < 2s, Supabase edge success rate >= 99.5%.
   - Alert on burn rate >2 for 1h windows, and on agent budget exhaustion.
6. **Error Budgets**
   - Maintain 0.5% monthly downtime budget; tie feature flag rollouts to remaining budget.
7. **Runbooks**
   - Document incident response for OTP outage, Supabase downtime, AI runaway cost; include rollback commands and communication templates.
