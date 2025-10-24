# Erasure Policy

Each table in `privacy.data_map` specifies the action taken during a right-to-erasure request.

| Schema.Table | Action | Details |
|--------------|--------|---------|
| core.profiles | delete | Remove the profile row. Supabase auth user remains but profile metadata is cleared. |
| agents.messages | redact | `user_wa` and `body` are replaced with `NULL` / `{}` while timestamps and routing remain for audit. |
| booking.itineraries | delete | Cascades to `booking.items`. Any dependent payments are redacted instead of deleted. |
| booking.items | delete | Deleted through itinerary cascade. |
| payment.payments | redact | Null `itinerary_id`, `idempotency_key`, `provider_ref`, and set `status` to `voided` while retaining amount/currency. |
| group.members | delete | Remove the user’s membership row; cascades contributions. |
| group.escrows | redact | Null `itinerary_id` but retain totals and group reference for accounting. |
| group.contributions | delete | Remove contribution rows (compensating adjustments stored elsewhere). |
| fin.invoices | redact | Clear `storage_path`, `payment_id`, `itinerary_id` and purge the stored HTML export; invoice number remains. |
| fin.ledger | redact | Null `provider_ref` and `note` but retain amounts and timestamps. |

## Idempotency & Rollback
- Dry runs never mutate data; executing erasure twice results in zero-count operations on subsequent runs.
- Redactions are irreversible once executed (PII is replaced with `NULL` or a placeholder).
- Deletions cascade per foreign-key rules; recovery would require database backups.
- Operators must confirm destructive actions by sending `confirm:"ERASE"` to the execute endpoint.
