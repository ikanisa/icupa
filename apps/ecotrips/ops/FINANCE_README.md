# Finance Operations

ecoTrips acts as Merchant of Record (MoR). Finance flows are additive and idempotent so that operators can replay steps without creating duplicate records.

## Components
- **Ledger (fin.ledger)**: immutable event stream covering `intent_created`, `capture_*`, and `refund_*` entries. Unique key = `(entry_type, payment_id, provider_ref)`.
- **Invoices (fin.invoices)**: metadata catalog for generated invoices and credit notes. HTML artifacts live in the `invoices` storage bucket at `<number>.html`, while `storage_path` stores the latest signed URL path.
- **Edge Functions**:
  - `fin-ledger-append`: internal RPC used by checkout, webhook, and refund flows.
  - `fin-invoice-generate`: builds HTML, stores it, and inserts the fin.invoices row. Safe to call multiple times; existing invoices return a fresh signed URL.

## Idempotency Keys
- **Ledger**: ensure duplicates of the same logical event reuse the same `(entry_type, payment_id, provider_ref)` tuple. Examples:
  - `intent_created`: provider_ref = Stripe payment intent id.
  - `refund_requested`: provider_ref = `<payment_intent_id>-refund-request`.
  - `refund_succeeded`: provider_ref = Stripe refund id.
- **Invoices**: repeat calls with identical `payment_id` and `kind` reuse the existing record/HTML. New numbers are allocated only when no prior invoice/credit note exists.

## Invoice Numbering & Rotation
- `fin.next_invoice_number()` yields `INV-YYYYMMDD-####` (UTC). Rotate the prefix by updating the function body in a new migration (e.g., `INV2-...`) and redeploying `fin-invoice-generate`.
- Credit notes reuse the originating invoice number with `-CN`. When no invoice exists, a fallback `CN-YYYYMMDD-####` is minted.

## Storage & Signed URLs
- Bucket: `invoices` (private). HTML uploads happen via the service role. Signed URLs default to 30-day expiry; operators can re-run `fin-invoice-generate` to refresh.

## Operator Checklist
1. **Ledger review**: query `fin.ledger` ordered by `occurred_at` for the relevant `payment_id`.
2. **Invoice issuance**: run `fin-invoice-generate` and deliver via `wa-send` `link_notice` (see Ops Runbook).
3. **Credit notes**: call `fin-invoice-generate` with `kind:'credit_note'` after a successful refund; ledger entries must show `refund_requested` → `refund_succeeded` sequence first.

Keep PII out of notes and log output. All audits include a `requestId` for traceability.
