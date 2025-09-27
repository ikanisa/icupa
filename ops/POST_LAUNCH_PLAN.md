# Post-Launch Hardening Plan

## Weekly
- Run `npm run test:ci` against staging and record results.
- Execute `k6 run tools/load/k6-smoke.js` with production-like traffic (see tools/load/README.md).
- Review `synthetics-probe` output and SLO dashboards.

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
