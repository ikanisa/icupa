# Supplier SLA Forecast Edge Function

The `supplier-sla-forecast` edge function aggregates nightly fixtures into actionable SLA risk bands for the ops dashboard heatmap.

- **Endpoint**: `GET /functions/v1/supplier-sla-forecast`
- **Health check**: `GET /functions/v1/supplier-sla-forecast/health`
- **Fixtures**: `ops/fixtures/supplier_slas.json`

## Risk Levels

Suppliers are mapped into three risk buckets:

| Risk Level | Signals |
| --- | --- |
| `breach` | Fixture `breach_state === "breach"` or any of: confirmation hours ≥ 12, cancellations ≥ 5%, open confirms ≥ 5 |
| `warning` | Fixture `breach_state === "warning"` or any of: confirmation hours ≥ 8, cancellations ≥ 3%, open confirms ≥ 3 |
| `on_track` | No breach or warning triggers |

Each response includes health check telemetry and pre-computed samples. Supplier entries link directly into the dashboard stub at `/ops/suppliers/[supplier]`.

## Sample Payloads

Reference payloads are stored in [`docs/ops/supplier-sla-forecast.samples.json`](./supplier-sla-forecast.samples.json). These show the default response along with a tier-filtered request surfaced in the admin UI.

### Quick Example

```json
{
  "request": {
    "method": "GET",
    "path": "/functions/v1/supplier-sla-forecast?risk=warning"
  },
  "response": {
    "ok": true,
    "totals": {
      "suppliers": 3,
      "by_risk": {
        "breach": 1,
        "warning": 1,
        "on_track": 1
      }
    },
    "heatmap": [
      {
        "supplier": "akagera-safaris",
        "profile_url": "/ops/suppliers/akagera-safaris",
        "risk": "warning"
      }
    ]
  }
}
```

Use the linked profile routes as drill-through targets when wiring new widgets under `apps/admin/app/(ops)/suppliers`.
