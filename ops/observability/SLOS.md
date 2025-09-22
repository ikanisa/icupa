# Service Level Objectives

Golden signals and target budgets for ecoTrips production.

## Checkout Success Rate
- **SLO**: ≥ 96% successful checkout completions (rolling 1 hour)
- **SLI**: `checkout.success / (checkout.success + checkout.fail)` aggregated from structured logs or metrics counters
- **Error Budget**: 4% per hour (~144 failed checkouts if 3,600 attempts)
- **Burn Alerts**:
  - Warning: >50% of budget consumed within 30 minutes
  - Critical: Budget exhausted within 15 minutes

## Webhook Latency
- **SLO**: p95 end-to-end latency < 3s for inbound webhooks (Planner/Payments)
- **SLI**: `http.response` logs with `event="http.response"` and `fn` matching webhook handlers
- **Error Budget**: 5% of requests allowed above 3s per day
- **Burn Alerts**:
  - Warning: >40% of daily budget consumed within 1 hour
  - Critical: >70% consumed within 30 minutes

## BFF Latency
- **SLO**: p95 latency < 500ms for BFF endpoints (`bff-quote`, `bff-checkout`)
- **SLI**: Structured response logs (`http.response`) filtered by `fn`
- **Error Budget**: 5% above threshold per day
- **Burn Alerts**:
  - Warning: p95 > 500ms for two consecutive 10-minute windows
  - Critical: p95 > 750ms for a single 5-minute window

## Finance Workflows
- **SLO (Refund)**: p95 time from `refund_requested` ledger entry to `refund_succeeded` ≤ 15 minutes (rolling 24h)
- **SLI**: Measure difference between timestamps of matching ledger entries (`fin.ledger`) grouped by `payment_id`
- **Error Budget**: 5% of refunds may exceed 15 minutes per day
- **SLO (Invoice Generation)**: Success ratio ≥ 99.5% (rolling 24h)
- **SLI**: `fin.invoice.generate` logs with `status=inserted|duplicate`; failures counted when handler throws or returns non-200
- **Burn Alerts**:
  - Refund SLO warning when budget burn >40% within 6h; critical >70% within 3h
  - Invoice generation warning when failure ratio >0.5% for 30m; critical when >1% for 15m

### Notes
- Error budgets reset every UTC day unless otherwise specified.
- Synthetic probe failures should deduct from availability budgets but not latency ones.
- Document and share remediation steps alongside alerts to drive faster incident response.
