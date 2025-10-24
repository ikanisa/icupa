# Privacy Data Map

| Schema | Table | Subject Column | PII Columns | Retention | Notes |
|--------|-------|----------------|-------------|-----------|-------|
| core | profiles | auth_user_id | auth_user_id, persona | n/a | Auth-linked profile metadata (delete on erasure) |
| agents | messages | user_id | user_wa, body | 30 days | WhatsApp transcript payload (redact body + WA identifiers) |
| booking | itineraries | user_id | user_id, notes | n/a | User itineraries including notes (delete cascades items) |
| booking | items | itinerary_id | pax, supplier_ref | n/a | Itemized booking entries (deleted when itinerary removed) |
| payment | payments | id | idempotency_key, provider_ref, status | 7 years | Financial intent records; redact identifiers, keep amounts |
| group | members | user_id | user_id | n/a | Group membership link (delete) |
| group | escrows | group_id | itinerary_id | 1 year | High-level escrow info; retain totals, null itinerary link |
| group | contributions | member_id | amount_cents, currency | n/a | Contribution rows (delete) |
| fin | invoices | payment_id | storage_path | 10 years | Invoice catalog; retain invoice number, clear storage link |
| fin | ledger | payment_id | note, provider_ref | 10 years | Immutable ledger; redact provider references |

- **Subject Column** identifies how a user is linked.
- **PII Columns** highlight data to redact when erasure rules require it.
- **Retention** reflects current policy (0/`n/a` = delete immediately, numeric days otherwise).
- `privacy.data_map` mirrors this table and feeds the export/erasure tooling.
