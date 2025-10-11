# Go‑Live Runbook

This runbook captures the minimum steps to promote ICUPA into staging/production.

## 1) Supabase project link and secrets

1. Login and link:
   ```bash
   supabase login  # requires SUPABASE_ACCESS_TOKEN
   supabase link --project-ref <project-ref>
   ```
2. Set secrets (recommended to use a checked‑in `.env.supabase` template populated in your secret manager):
   ```bash
   ./scripts/supabase/set-secrets.sh --project <project-ref> --env-file .env.supabase
   ```

Required secrets by surface:
- Core: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_INVITE_REDIRECT_URL`, `ADMIN_ONBOARDING_SECRET`
- OCR: `OPENAI_API_KEY`, `OCR_CONVERTER_URL`, `OCR_CONVERTER_TOKEN`
- Payments (EU): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Payments (RW): `MOMO_*`, `AIRTEL_*`
- Push: VAPID private key stored in Supabase, public key in the app env

## 2) Deploy Edge Functions

```bash
./scripts/supabase/deploy-functions.sh --project <project-ref>
```

(Optional) run via GitHub Actions `Supabase Deploy Functions` workflow with `project_ref` and `SUPABASE_ACCESS_TOKEN` secret.

## 3) Configure embeddings refresh cron

Update the menu embedding refresh function URL:
```bash
./scripts/supabase/update-scheduler-url.sh \
  --project <project-ref> \
  --url https://<project-ref>.functions.supabase.co/menu/embed_items
```

Alternatively, use the Ops endpoint (no CLI required):
```bash
BASE="https://<project-ref>.functions.supabase.co"
TOKEN="$SUPABASE_SERVICE_ROLE_KEY"  # or use $ADMIN_ONBOARDING_SECRET
./scripts/ops/update-scheduler.sh --url "$BASE/menu/embed_items"
```

## 4) Observability

- Dashboards: point panels to `rpc.list_queue_metrics` and `rpc.list_cron_jobs`.
- Alerts: create rules for queue backlog, cron failures, and Functions 5xx.

## 5) E2E checks on staging

Run Playwright against the staging URL:
```bash
PLAYWRIGHT_BASE_URL=https://staging.icupa.dev npm run test:e2e \
  -- --config tests/playwright/playwright.config.ts --reporter=html
```

(Optional) run via GitHub Actions `Playwright E2E` with `base_url` input.

### Ops Health Checks

Run the Functions smoke and DB health checks to validate routing and required RPCs:
```bash
BASE="https://<project-ref>.functions.supabase.co" \
  ./scripts/smoke/functions-smoke.sh

BASE="https://<project-ref>.functions.supabase.co" \
  ./scripts/ops/db-health.sh
```

If queue RPCs are missing in hosted environments without PGMQ, apply the fallback with the DB repair snippet (via SQL Editor):
`docs/snippets/db-repair.sql`.

## 6) Canary rollout

- Restrict agent autonomy and budgets in `agent_runtime_configs`.
- Flip a single launch tenant/location, monitor error budgets and dashboards.
- Expand gradually after 24–48h of clean KPIs.

## 7) Rollback

- Disable cron and set `agent_runtime_configs.enabled=false` for relevant agents.
- Revert recent Functions via the CLI `supabase functions deploy <fn>@<prev_hash>`.
- Restore DB from the last snapshot if needed and re‑seed queues.

---

For questions, see `docs/observability.md` and the Admin Access tab for staff invites.
