# Post-Launch Hardening Plan

## Weekly
- Run `npm run test:ci` against staging and record results.
- Execute `k6 run tools/load/k6-smoke.js` with production-like traffic (see tools/load/README.md).
- Review the expanded `synthetics-probe` dashboard covering BFF, inventory, payments, messaging, groups, privacy, and observability edge functions. Track category availability, latency, and critical failure counts in Grafana (`Observability > Synthetic Coverage`).

## Monthly
- Rotate secrets: Stripe, Hotelbeds, WhatsApp, Supabase service-role.
- Update Deno std imports (`https://deno.land/std`) across functions.
- Run `npm audit` and patch vulnerable dependencies.
- Review RLS policies and confirm no new tables were added without protection.

## Quarterly
- Perform chaos testing: introduce downstream failures and confirm circuit breakers, retries, and alerting behaviour.
- Exercise blue/green deployment via `scripts/deploy/blue_green.sh` in staging and document timings.
- Refresh observability exports (confirm logs shipping, metrics ingestion, dashboards up to date).

Track completion of these tasks in the ops run log. Tie any discovered issues back to Jira tickets so improvements are visible.

## Dashboards & Synthetic Coverage
- **Synthetic Coverage (Grafana):** Aggregates `synthetics-probe` results with per-category availability and latency metrics across BFF, inventory, messaging, privacy, payments, and groups functions. Use this to confirm critical edge functions stay above 99% availability week over week.
- **Edge Function Analytics (Supabase):** Metrics forwarded via `OBS_ANALYTICS_WEBHOOK_URL` land in the analytics pipeline; review derived dashboards for structured request/response logs, latency percentiles, and metric counters aligned to the new schema.
