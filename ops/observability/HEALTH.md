# Health Endpoints

Each edge function exposes a lightweight `GET /health` route via the observability wrapper. Calls return `200 {"ok":true,"fn":"<name>","time":"<iso>"}` when the handler is reachable. Examples (replace `<project>` with `woyknezboamabahknmjr`):

- `https://<project>.supabase.co/functions/v1/bff-quote/health`
- `https://<project>.supabase.co/functions/v1/bff-checkout/health`
- `https://<project>.supabase.co/functions/v1/wa-send/health`
- `https://<project>.supabase.co/functions/v1/wa-webhook/health`
- `https://<project>.supabase.co/functions/v1/stripe-webhook/health`
- `https://<project>.supabase.co/functions/v1/supplier-webhook/health`
- `https://<project>.supabase.co/functions/v1/ops-bookings/health`
- `https://<project>.supabase.co/functions/v1/ops-exceptions/health`
- `https://<project>.supabase.co/functions/v1/ops-refund/health`
- `https://<project>.supabase.co/functions/v1/groups-create-escrow/health`
- `https://<project>.supabase.co/functions/v1/groups-contribute/health`
- `https://<project>.supabase.co/functions/v1/groups-join/health`
- `https://<project>.supabase.co/functions/v1/groups-ops-payout-now/health`
- `https://<project>.supabase.co/functions/v1/groups-payouts-report/health`
- `https://<project>.supabase.co/functions/v1/groups-payout-worker/health`
- `https://<project>.supabase.co/functions/v1/permits-request/health`
- `https://<project>.supabase.co/functions/v1/permits-ops-approve/health`
- `https://<project>.supabase.co/functions/v1/permits-ops-reject/health`
- `https://<project>.supabase.co/functions/v1/agent-orchestrator/health`
- `https://<project>.supabase.co/functions/v1/agents-eval-runner/health`
- `https://<project>.supabase.co/functions/v1/agents-eval-report/health`
- `https://<project>.supabase.co/functions/v1/metrics-incr/health`
- `https://<project>.supabase.co/functions/v1/synthetics-probe/health`

Health routes intentionally avoid touching downstream systems; they validate that the function bundle loads, configuration is present, and the runtime can respond.
