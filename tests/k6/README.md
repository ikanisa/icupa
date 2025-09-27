# Phase 10 k6 Load Testing Scaffold

The performance engineering vendor will place all Phase 10 load-testing assets within this folder. The structure mirrors the outsourcing playbook and keeps the artefacts version-controlled next to the application code.

## Directory layout

```
tests/k6/
├── README.md
├── scripts/
│   ├── create_table_session.js   # Simulates diner onboarding via QR
│   └── payments_webhooks.js      # Drives webhook fan-in under load
├── lib/                          # Shared helpers (authentication, payload builders)
└── results/                      # Raw k6 JSON/HTML exports (gitignored)
```

`lib/` and `results/` are optional convenience folders. Vendors can add additional scenarios but should maintain the naming convention referenced in the playbook.

## Executing a dry run

1. Install [k6](https://k6.io/docs/get-started/installation/) locally.
2. Ensure the staging environment is seeded with representative data and the Supabase policies required for load testing.
3. Export the target deployment URL and auth tokens expected by the scripts:

   ```sh
   export ICUPA_BASE_URL="https://staging.icupa.example"
   export ICUPA_SUPABASE_SERVICE_KEY="<service-role>"
   ```

4. Run a scenario:

   ```sh
   k6 run scripts/create_table_session.js
   ```

5. Commit the updated scenario definitions and upload the result bundles to the agreed storage (`artifacts/phase10/load/`).

## Result handling

- k6 JSON summaries should be named `YYYYMMDD-<scenario>-summary.json`.
- HTML reports should be named `YYYYMMDD-<scenario>-report.html`.
- Upload the result bundles to the GitHub Action artifact or vendor portal after each run.

## Observability checklist

Performance runs must be coordinated with the Platform Engineering owner to ensure Grafana dashboards, Supabase logs, and tracing collectors are monitored during tests. Annotate start/stop timestamps in the `#perf-load` channel and file follow-up tickets for any SLA breach.
