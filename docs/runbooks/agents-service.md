# Runbook: agents-service

## Overview

`agents-service` powers the OpenAI agent interactions for diners and staff. It runs as a Dockerized Fastify server within the mono-repo workspace, depends on Supabase for session/state, and exports telemetry via OpenTelemetry. This runbook documents day-2 operations, including phased deployments, monitoring, and incident response.

## Contacts

| Role | Contact |
| --- | --- |
| Primary On-Call | `#ops-ai` (PagerDuty schedule: `AI Platform`) |
| Secondary | `#backend-alerts` |
| Vendor | OpenAI Enterprise Support (support@openai.com) |

Escalate to the AI Platform lead if outages exceed 15 minutes or if OpenAI cost anomalies are suspected.

## Dashboards & Logs

- Grafana: `Agents / Latency & Cost` dashboard (`https://grafana.icupa.dev/d/ag-ops`)
- Grafana: `ICUPA/ai-guardrails` (tracks hallucination + policy violations)
- Jaeger: trace search scoped to `service.name = icupa-agents-service`
- Supabase Logs: `supabase projects logs --project-ref <ref>`
- Lighthouse: ensure conversational flows maintain A11y/Perf thresholds (see `artifacts/lighthouse/`)

## Deployments

1. Build & push the container:
   ```bash
   cd agents-service
   pnpm build
   docker build -t icupa-agents:${GIT_SHA} .
   docker push <registry>/icupa-agents:${GIT_SHA}
   ```
2. Update deployment (`deployments/<env>/agents-service.yaml`) with new digest.
3. Apply manifest: `kubectl apply -f deployments/<env>/agents-service.yaml`.
4. Run smoke tests:
   - `curl -H "Authorization: Bearer <token>" https://agents.<env>.icupa.dev/health`
   - `pnpm --filter agents-service test:smoke`
5. Post deployment summary in `#deployments` with image digest, feature flags touched, and Lighthouse/coverage artifact links.

### Phased Rollout

- Enable new behaviors via `agent_runtime_configs` feature flags (`ai_waiter.v2.enabled`).
- Follow cadence: internal tenants → pilot tenants → full rollout (see `go-live.md`).
- Monitor SLOs (latency, error rate, hallucination) at each phase; rollback if breach occurs.

## Rollback

1. Identify last good digest (`git tag`, `#deployments` log).
2. Update manifest with previous digest and apply.
3. Disable associated feature flags using admin console or CLI (`pnpm flags:disable ...`).
4. Verify health check recovery, run smoke suite, trigger Lighthouse run for regressions.
5. Log the event in `docs/runbooks/rollback-log.md` with incident links.

## Alerts & Mitigation

| Alert | Action |
| --- | --- |
| `agents-service latency p95 > 5s` | Check Grafana, inspect OpenAI latency. Consider switching to backup model via feature flag. |
| `agents-service error rate > 2%` | Validate Supabase connectivity, confirm migrations applied, check feature flag gating. |
| `OpenAI spend > budget` | Budgets set via `AGENT_SESSION_BUDGET_USD` & `AGENT_DAILY_BUDGET_USD`. Tighten config or enable guardrails. Notify finance. |
| `Guardrail breach spike` | Review `agent_events` table, ensure policy updates deployed. Engage Trust & Safety. |

## Secrets Rotation

- Rotate OpenAI API keys quarterly. Update `agents-service.env` + Supabase secrets, redeploy.
- Rotate Supabase service-role key quarterly. Propagate to agents-service and Edge Functions.
- Rotate OAuth client secret annually or on compromise.
- Update OTLP exporter token when Grafana Cloud token rotates.

## Disaster Recovery

1. Standby environment in `fra1` mirrors production.
2. Failover steps:
   - Deploy Compose/K8s stack in standby with mirrored secrets.
   - Lower DNS TTL to 15s and switch `agents.icupa.dev` to standby IP.
   - Validate TLS via `curl -Iv`.
   - Announce failover in `#status` and record in rollback log.
3. After failover, run `pnpm --filter agents-service test:smoke` and Lighthouse regression.

## Appendices

- Environment variable reference: `docs/deployment/agents-service.md` §3.
- Budget calculations: `AGENT_SESSION_BUDGET_USD` × forecasted session volume vs. daily cap.
- Vector store refresh: `pnpm agents:sync-vector-stores` prior to redeploying.
- Zero downtime migrations: follow `docs/runbooks/zero-downtime-migration.md` when schema impacts agent tables.

