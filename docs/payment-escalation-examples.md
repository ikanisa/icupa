# Payment escalation fixtures

The `payment-escalate` edge function returns mocked next actions and health checks so teams can exercise failure flows without
hitting live processors. The payload mirrors Stripe + MoMo incident responses and is safe to use in preview deployments.

## Request shape

```json
{
  "itineraryId": "1f5c4de8-6f21-4cf1-86bb-1f9be0a3150d",
  "paymentId": "e40fe6f2-5f97-4b65-8d52-1f3b4f19acb6",
  "failureCode": "stripe_unavailable",
  "idempotencyKey": "intent-1f5c4de8-6f21-4cf1-86bb-1f9be0a3150d",
  "amountCents": 182000,
  "currency": "USD"
}
```

## Sample response

```json
{
  "ok": true,
  "request_id": "req_fixture",
  "headline": "Stripe API degradation",
  "summary": "Upstream 5xx/429 responses detected; retries should space out to honor rate limits.",
  "failure_code": "stripe_unavailable",
  "itinerary_id": "1f5c4de8-6f21-4cf1-86bb-1f9be0a3150d",
  "payment_id": "e40fe6f2-5f97-4b65-8d52-1f3b4f19acb6",
  "idempotency_key": "intent-1f5c4de8-6f21-4cf1-86bb-1f9be0a3150d",
  "next_actions": [
    {
      "id": "retry-intent",
      "title": "Retry after cool-off",
      "description": "Stripe returned HTTP 429. Wait 30s then retry using the same idempotency key.",
      "cta_label": "Retry in 30s",
      "cta_type": "retry_intent",
      "idempotency_hint": "intent-1f5c4de8-6f21-4cf1-86bb-1f9be0a3150d",
      "wait_seconds": 30
    },
    {
      "id": "switch-offline",
      "title": "Fallback to PAYMENT_MOCK",
      "description": "If retries fail, switch to ledger-only capture and notify finance duty manager.",
      "cta_label": "Notify finance ops",
      "cta_type": "contact_ops",
      "contact_channel": "#finops-alerts"
    }
  ],
  "health_checks": [
    {
      "id": "stripe-latency",
      "name": "Stripe latency",
      "status": "fail",
      "detail": "p95 = 18.4s (threshold 4s).",
      "last_checked": "2024-07-18T07:25:41.000Z"
    },
    {
      "id": "ledger",
      "name": "Ledger consistency",
      "status": "pass",
      "detail": "No duplicate entries detected.",
      "last_checked": "2024-07-18T07:24:12.000Z"
    }
  ],
  "source": "fixtures"
}
```

Use the same structure for other failure codes (`card_declined`, `unknown`) and confirm that UI flows render the CTA buttons and
status pills surfaced by the function.
