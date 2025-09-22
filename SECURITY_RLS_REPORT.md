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
- RPC added: payment.ensure_payment_record — inserts payment rows with 'processing' status; executes under authenticated role.

## Groups RLS
- Policy `p_groups_owner_all` — allows `ALL` commands when the row owner matches `auth.uid()`.
