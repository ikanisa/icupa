# Runbook: agents-service

## Overview

`agents-service` powers the OpenAI agent interactions for diners and staff. It runs as a Dockerized Fastify server with Supabase integrations and exports telemetry via OpenTelemetry. This runbook documents day-2 operations, including deployments, monitoring, and incident response.

## Contacts

| Role | Contact |
| --- | --- |
| Primary On-Call | `#ops-ai` (PagerDuty schedule: `AI Platform`) |
| Secondary | `#backend-alerts` |
| Vendor | OpenAI Enterprise Support (support@openai.com) |

Escalate to the AI Platform lead if outages exceed 15 minutes or if OpenAI cost anomalies are suspected.

## Dashboards & Logs

* Grafana: `Agents / Latency & Cost` dashboard (`https://grafana.icupa.dev/d/ag-ops`)
* Jaeger: trace search scoped to `service.name = icupa-agents-service`
* Supabase Logs: `supabase projects logs --project-ref <ref>`

## Deployments

1. Build & push the container (`docs/deployment/agents-service.md`).
2. Update the Compose stack or Kubernetes deployment to the new image digest.
3. Run smoke tests:
   * `curl -H "Authorization: Bearer <token>" https://agents.icupa.dev/health`
   * `npm run smoke:agents` (future automation TBD)
4. Post deployment summary in `#deployments` with image digest, vector store versions, and environment sync confirmation.

## Rollback

1. Identify the last known-good image digest (look in `#deployments` or the Git tag release notes).
2. Update the VM Compose stack: `docker compose pull && docker compose up -d agents-service` pinned to the digest via `image: ghcr.io/icupa/agents-service@sha256:...`.
3. For Kubernetes: `kubectl rollout undo deployment/agents-service` or set the previous digest in the manifest.
4. Confirm health check recovery and send status update.

## Alerts & Mitigation

| Alert | Action |
| --- | --- |
| `agents-service latency p95 > 5s` | Check Grafana dashboard, inspect OpenAI latency. Fallback to low-cost model if failover triggered. |
| `agents-service error rate > 2%` | Inspect Supabase connectivity and OpenAI quota. If OpenAI fails, set `OPENAI_BASE_URL` to backup proxy. |
| `OpenAI spend > budget` | Budgets set via `AGENT_SESSION_BUDGET_USD` & `AGENT_DAILY_BUDGET_USD`. Tighten or disable traffic. Notify finance. |
| `oauth2-proxy 401 spikes` | Confirm identity provider uptime, refresh OAuth client secret if expired. |

## Secrets Rotation

* Rotate OpenAI API keys quarterly. Update `agents-service.env` and redeploy.
* Rotate Supabase service-role key quarterly. Update both agents service and Edge Function secrets.
* Rotate OAuth client secret annually or on compromise.
* Update OTLP exporter token when Grafana Cloud token rotates.

## Disaster Recovery

* Standby environment in `fra1` replicates the stack. Failover steps:
  1. Deploy Compose stack in standby VM with mirrored secrets.
  2. Update DNS (`agents.icupa.dev`) TTL 60s -> 15s before failover.
  3. Switch DNS to standby IP, verify TLS via `curl -Iv`.
  4. Announce failover in `#status`.

## Appendices

* Environment variable reference: see `docs/deployment/agents-service.md` §3.
* Budget calculations: `AGENT_SESSION_BUDGET_USD` × forecasted session volume vs. daily cap.
* Vector store refresh: run `npm run agents:sync-vector-stores` before redeploying.
