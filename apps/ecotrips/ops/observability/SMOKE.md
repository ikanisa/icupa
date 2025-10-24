# Observability Smoke Checks

## Local / Offline
1. Pick an instrumented function (e.g. `bff-quote`).
   ```sh
   curl -s "https://woyknezboamabahknmjr.supabase.co/functions/v1/bff-quote" \
     -H "Content-Type: application/json" \
     -d '{"items":[{"id":"hotel_A"}]}'
   ```
   Expect three JSON log lines in the Supabase function logs:
   - `{"level":"AUDIT","event":"http.request",...}`
   - `{"level":"INFO","event":"http.response",...}`
   - Any domain-specific `AUDIT` entries (e.g., quote metadata).

2. Run the synthetics probe to check critical health endpoints.
   ```sh
   curl -s "https://woyknezboamabahknmjr.supabase.co/functions/v1/synthetics-probe"
   ```
   Response includes `ok_count`, `fail_count`, and per-function timings. A fail status triggers HTTP `503`.

3. Increment a metrics counter manually (for low-volume KPIs).
   ```sh
   curl -s "https://woyknezboamabahknmjr.supabase.co/functions/v1/metrics-incr" \
     -H "Content-Type: application/json" \
     -d '{"name":"checkout.success"}'
   ```
   Inspect `metrics.counters` for the updated total.

## CI Smoke (see `.github/workflows/ci.yml`)
- Validates formatting/caching and runs an offline curl suite against ops endpoints.
- Adds an observability check verifying multiple functions import `withObs` and emit structured response logs.
