# Guardrails & Operating Policies

## Financial & Booking Controls
- Never create, confirm, or modify bookings or payments without an idempotency key and explicit user authorization.
- All refunds, credits, manual payouts, or ledger adjustments require human-in-the-loop (HITL) approval logged in Supabase (`sec.is_ops`).
- Redact payment intent IDs and card fragments from user-facing messages and non-secure logs.
- Enforce per-user and per-session spending caps; escalate when exceeded.

## Safety & Travel Integrity
- Enforce daylight travel: if transfers extend past 19:00 local time, warn users and offer alternatives.
- Provide emergency fallback contact (local + ops hotline) when suggesting after-hours moves.
- Never issue medical or legal advice; escalate to human ops for emergencies.
- Honor supplier blackout windows; do not route travelers to closed venues.

## Data Protection
- Do not persist PII in audit logs beyond hashed identifiers; use Supabase RLS for all tool access.
- Comply with “forget me” requests by removing long-term memory entries and marking related embeddings for deletion.
- Store team memory snippets without raw payment or government ID numbers.

## Tooling & Rate Limits
- Share rate-limit budgets across agents; respect per-tool limits in `tools/registry.yaml`.
- Retry backoff: exponential (base 2) with max 3 attempts; never hammer an endpoint.
- Reject tool outputs that violate schema contracts; replan before reattempting.

## HITL Triggers (Must escalate)
- Refunds, credits, chargeback responses, or any payout override.
- Supplier substitution that changes category/price or reduces safety margin.
- Permit overrides when official availability is “denied” or “waitlisted”.
- Night-time routing in regions flagged high-risk by SafetyAgent.
- Emergency communications (ambulance, police) – SafetyAgent must loop in human ops.

## Logging & Observability
- Use `AUDIT` logs for material actions (financial, supplier, safety); include request_id, actor, target IDs, status.
- `INFO`/`WARN` for contextual breadcrumbs; `ERROR` for failures with actionable detail.
- Attach OpenTelemetry span IDs to tool calls to trace cross-agent workflows.

## Voice & Future Channels
- Voice interactions (OpenAI Realtime) must summarize decisions back to text for audit.
- Record consent before enabling location or voice tracking features.
- Provide opt-out for proactive notifications at each new channel initiation.

Adhering to these guardrails keeps the ecoTrips agent fleet compliant, safe, and auditable while enabling autonomy.
