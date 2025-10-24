-- Scope B2B lead intent idempotency keys to the owning API key.
set search_path = public;

drop index if exists travel.travel_intents_idempotency_idx;
create unique index if not exists travel_intents_api_key_idempotency_idx
  on travel.intents (api_key_id, idempotency_key);
