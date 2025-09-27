# Chaos & Load Drill Scripts

Use these scripts to rehearse the quarterly chaos scenarios described in `docs/runbooks/chaos-drill.md`.

## Load baselines

1. Build the web bundle: `npm run build`.
2. Run Lighthouse budgets: `npm run test:perf`.
3. Execute the k6 webhooks script: `k6 run tests/k6/scripts/payments_webhooks.js` (configure `K6_SUPABASE_URL` and `K6_ANON_KEY`).

## Chaos helpers

### Pause Stripe webhooks

```sql
select pgmq.send('chaos_stripe_pause', jsonb_build_object('enabled', false));
```

Unpause with `true`. The admin Edge Function should consume this queue and toggle feature flags.

### Flood fiscal queue

```sql
select pgmq.send('fiscalization_jobs', jsonb_build_object('order_id', :order_id, 'payment_id', :payment_id));
```

Use staging IDs and monitor `payment_reconciliation_runs` for discrepancy spikes.

### Disable upsell agent

```sql
update public.agent_runtime_configs
set enabled = false
where agent_type = 'upsell' and tenant_id = :tenant_id;
```

Restore to `true` after confirming waiter disclaimers fire.

> Always run these commands in staging unless you have explicit production approval.
