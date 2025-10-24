# Ops Console Plan

## Purpose
Admin-only console to operate ecoTrips: manage bookings, handle exceptions, process refunds, and monitor supplier SLAs.

## Auth Model
- Supabase Auth for authentication.
- RBAC via `ops_admin` role enforced through RLS/policies.
- All routes protected; no public access.

## Routes & Pages (MVP)
- `/ops/manifests` — list upcoming bookings with date/supplier filters and a detail drawer showing traveler info & vouchers.
- `/ops/exceptions` — queue of failed webhooks, partial payments, permit rejections; actions: retry, escalate, rebook.
- `/ops/refunds` — create credit notes/refunds, inspect ledger entries, export CSV.
- `/ops/supplier-slas` — monitor per-supplier confirmation times, cancellations, and breach alerts.

## Key Components per Page
- Data table for records.
- Filter controls (date, supplier, status as applicable).
- Detail drawer for focused record context.
- Action toolbar for inline operations.
- Toast/alert system for feedback.

## Data Needs & APIs
- `/ops/manifests`: `GET /ops/bookings`, `GET /ops/bookings/{id}` for detail.
- `/ops/exceptions`: `GET /ops/exceptions`, `POST /ops/retry-webhook`, `POST /ops/escalate`, `POST /ops/rebook`.
- `/ops/refunds`: `GET /ops/refunds`, `POST /ops/refund`, `GET /ops/refunds/export`.
- `/ops/supplier-slas`: `GET /ops/suppliers/slas`, `GET /ops/suppliers/{id}/breaches`.

## Telemetry
- Log every action with a `requestId` for traceability.
- Plan to add golden signals (latency, error rate, throughput) in future iterations.

## Security Notes
- Maintain an audit trail for each action.
- Enforce least-privilege principles across APIs and UI.
- Avoid logging PII; redact sensitive fields before telemetry.

## Next Steps
1. Scaffold Next.js app.
2. Wire Supabase session & RBAC guardrails.
3. Add read-only manifests view.
4. Implement exception handling actions.
