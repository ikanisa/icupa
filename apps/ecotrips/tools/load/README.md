# Load & Resilience Suite

Use the scripts in this folder once production credentials are available.

## Smoke (k6)
```bash
k6 run tools/load/k6-smoke.js \
  -e SUPABASE_TEST_URL=https://<project>.supabase.co \
  -e SUPABASE_TEST_SERVICE_ROLE_KEY=<service-role>
```

## Failure & Chaos Ideas
- Inject latency into Hotelbeds APIs by overriding `HBX_BASE` to a proxy that delays 200ms and observe circuit-breaker behaviour.
- Replay Stripe webhooks (success + failure) at high frequency to confirm ledger idempotency.
- Flip `WA_OFFLINE=1` mid-run and ensure `wa-send` recovers once the flag is cleared.

Document the results in the post-launch log (see `ops/POST_LAUNCH_PLAN.md`).
