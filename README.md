[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
# ecoTrips — Monorepo
PWA + Supabase + Edge Functions baseline (starter).

- [Production readiness checklist](ops/PRODUCTION_READINESS.md)
- [Incident response playbook](ops/INCIDENT_RESPONSE.md)
- [Post-launch hardening cadence](ops/POST_LAUNCH_PLAN.md)

## Post-merge TODOs
- [ ] Add Playwright preview smoke tests covering PWA install + admin auth gate.
- [ ] Wire Sentry/error scrape dashboard for Supabase Edge Functions.
- [ ] Ship federated search engine (phase 2) across inventory + content.
- [ ] Explore voice concierge pilot (phase 2) with GPT-5 realtime.

## Branching Policy
See [docs/branching.md](docs/branching.md) for the authoritative branching workflow, including how the canonical `main` branch is
maintained from `work`, how feature branches are rebased, and how fast-forward merges keep history linear.
