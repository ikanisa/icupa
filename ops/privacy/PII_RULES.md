# PII Masking & Retention Rules

Operators must follow the same retention and masking behaviors defined in [`DATAMAP.md`](./DATAMAP.md) and the [`ERASURE_POLICY.md`](./ERASURE_POLICY.md). This quick reference summarizes how to treat common data classes when preparing exports, responding to data-subject requests, or handling ad-hoc scans.

## Masking Guidance

| Data Class | Masking Strategy | Notes |
|------------|------------------|-------|
| Email addresses | Replace the local-part with `***` (e.g., `***@example.com`). | Leave domain intact so support can route follow-ups. |
| Phone numbers | Keep country code + last two digits; replace middle digits with `•` (e.g., `+250 ••• ••42`). | Applies to WhatsApp handles captured in `agents.messages`. |
| Government IDs | Store only the final four characters; prefix with document type (e.g., `NID ****1234`). | IDs should not persist beyond 30 days unless legally required. |
| Payment instrument tokens | Do not expose raw tokens. Record a reference alias (e.g., `vault_ref:abc123`). | Full tokens remain only in PSP vaults per `payment.payments` retention. |
| Free-form notes | Strip names and contact info using the `privacy-pii-scan` edge function before sharing externally. | Preserve operational context where possible. |

- Use structured placeholders (`NULL`, `{}`) when redacting columns so downstream systems can detect masking.
- When exporting data, apply the same redaction transforms before generating signed URLs.

## Retention Expectations

- Follow the `Retention` column from the [data map](./DATAMAP.md); it mirrors `privacy.data_map` used by automation.
- Financial records (`payment.*`, `fin.*`) keep monetary fields for 7–10 years but must redact personal identifiers immediately after erasure approval.
- Messaging payloads (`agents.messages`) auto-expire after 30 days; manual exports should enforce the same window.
- Any ad-hoc scan producing PII findings must be logged to `audit.events` with context on where the data was discovered.

## Workflow Checklist

1. Run `privacy-pii-scan` on the text or artifact under review.
2. Mask findings according to the table above before sharing outside the privacy pod.
3. Record the scan outcome (who, what, findings count, residual risk) in `audit.events`.
4. Align any follow-up actions with the erasure policy to keep retention and masking consistent.

These rules keep console operations aligned with our documented privacy processes while we iterate on automation.
