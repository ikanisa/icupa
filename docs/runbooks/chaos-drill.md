# Chaos & Load Drill Playbook

This guide codifies quarterly chaos exercises for ICUPA production environments.

## Scope

- **Payments**: degrade Stripe/MoMo/Airtel webhooks, introduce 502 responses, verify automatic retries and alerting (`payment_webhook_events` duplicates stay ≤1%).
- **Fiscalization**: pause the `fiscalization_jobs` queue to confirm receipt SLAs and fallback simulation.
- **Agents**: disable the upsell agent runtime config and ensure waiter agent falls back to staff messaging.

## Execution steps

1. Schedule a 60-minute window with SRE, Payments, and Merchant Ops. Record participants in PagerDuty.
2. Run load baseline using `npm run test:perf` and `k6 run tests/k6/scripts/payments_webhooks.js` against staging to capture control metrics.
3. Trigger chaos scenarios sequentially:
   - Use the Supabase SQL console to pause `payments.stripe/webhook` edge function via `ALTER`. Observe alert firing in Grafana.
   - Enqueue 50 synthetic fiscalization jobs (`select pgmq.send(...)`) and simulate downstream outage. Confirm fallback receipts and slack alert.
   - Flip `agent_runtime_configs.enabled = false` for `upsell` in staging. Verify waiter disclaimers.
4. Capture recovery steps and timings.
5. Post-mortem: file follow-up tasks for missed alerts or automation gaps.

## Artefacts

- Store drill charts/screenshots in `artifacts/chaos/YYYY-MM-DD/`.
- Update this runbook with improvements after each exercise.

## Contacts

- SRE primary: sre@icupa.dev
- Payments on-call: payments@icupa.dev
- Merchant Ops lead: ops@icupa.dev
