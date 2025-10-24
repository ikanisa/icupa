# Latest Agents Eval Runner Attempt

- **Command:** `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=test deno run -A supabase/functions/agents-eval-runner/index.ts`
- **Invocation:** `curl -s -X POST http://127.0.0.1:8000 -H "Content-Type: application/json" -d '{"label":"local-smoke","limit":4}'`
- **Result:** Run `local-smoke` completed against mock Supabase services with **3/3** cases passing (`run_id=local-run-1761260328974`).

```json
{
  "ok": true,
  "run_id": "local-run-1761260328974",
  "total": 3,
  "passed": 3,
  "failed": 0,
  "request_id": "7def6787-00e0-487e-be2f-26538e2e027e"
}
```

> Notes: a local stub Supabase server returned deterministic responses so the runner could execute without production credentials.
