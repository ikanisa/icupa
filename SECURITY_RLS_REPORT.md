# RLS Report

- core.profiles
  - Profiles select own — select
- booking.itineraries
  - Itineraries select own — select
  - Itineraries insert own — insert
  - Itineraries update own — update
- booking.items
  - Items select via itinerary — select
  - Items insert via itinerary — insert
  - Items update via itinerary — update
  - Items delete via itinerary — delete
- payment.payments
  - Payments select via itinerary — select
  - Service-only access enforced (`p_payment_service_only`)
- RPC added: payment.ensure_payment_record — inserts payment rows with 'processing' status; executes under authenticated role.

## Groups RLS
- Policy `p_groups_owner_all` — allows `ALL` commands when the row owner matches `auth.uid()`.

## Additional Hardening
- fin.ledger — policy `p_fin_ledger_service_only` restricts all commands to the service role.
- fin.invoices — policy `p_fin_invoices_service_only` restricts all commands to the service role.
- privacy.requests / privacy.datamap — policies `p_privacy_requests_service_only` and `p_privacy_datamap_service_only` limit access to the service role for edge workflows.
