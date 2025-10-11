# Observability & Telemetry

## Agents service (apps/agents-service)

- OpenTelemetry traces are initialised in `src/telemetry/index.ts` (barrels `observability.ts`). Enable export by setting:
  - `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g., `https://otel.example.com`)
  - `OTEL_EXPORTER_OTLP_HEADERS` for auth tokens if required
  - `OTEL_SERVICE_NAME` defaults to `icupa-agents-service`
- Each agent run logs to `agent_events` (see `services/telemetry.ts`) with input summary, tools used, usage, and cost. Budget guards live alongside these helpers.
- Feature flags / kill switches read from `agent_runtime_configs`; ensure monitoring dashboards highlight when autonomy is disabled per tenant.

## Web app (apps/web)

- Client toast/telemetry helpers live under `src/lib/` and `src/hooks/useBackgroundSyncToast`.
- Use `console.warn` only for actionable warnings; prefer `console.error` with sanitized payloads in error paths.
- For new instrumentation, route through a shared logger (`src/lib/logger.ts` planned during refactor) to keep formatting consistent.

## Supabase functions

- Logging happens via `console.error`/`console.warn` in Edge Functions. Always redact PII (phone numbers, OTPs, MoMo codes). The ingestion helpers already mask phone numbers (`maskPhone`), and payments helpers log trace IDs.
- When adding new functions, follow the pattern in `_shared/` modules: return JSON errors with codes, and avoid printing raw request bodies.
