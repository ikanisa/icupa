create or replace view public.referral_balances_overview as
select
  rb.user_id,
  rb.available_cents,
  rb.pending_cents,
  rb.currency,
  rb.lifetime_referred,
  rb.lifetime_rewards_cents,
  coalesce(jsonb_agg(
    jsonb_build_object(
      'id', rl.id,
      'created_at', rl.created_at,
      'source', rl.source,
      'amount_cents', rl.amount_cents,
      'currency', rl.currency,
      'status', rl.status
    )
    order by rl.created_at desc
  ) filter (where rl.id is not null), '[]'::jsonb) as recent_rewards
from growth.referral_balances rb
left join growth.reward_ledger rl on rl.user_id = rb.user_id
group by rb.user_id, rb.available_cents, rb.pending_cents, rb.currency, rb.lifetime_referred, rb.lifetime_rewards_cents;

grant select on public.referral_balances_overview to authenticated;

grant select on public.referral_balances_overview to service_role;

create or replace view public.price_lock_offer_overview as
select
  plo.id,
  plo.created_at,
  plo.itinerary_id,
  plo.user_id,
  plo.hold_reference,
  plo.hold_expires_at,
  plo.price_cents,
  plo.currency,
  plo.status,
  plo.consent_captured_at,
  plo.telemetry,
  coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ple.id,
      'event_type', ple.event_type,
      'created_at', ple.created_at,
      'payload', ple.payload
    )
    order by ple.created_at desc
  ) filter (where ple.id is not null), '[]'::jsonb) as events
from growth.price_lock_offers plo
left join growth.price_lock_events ple on ple.offer_id = plo.id
group by
  plo.id,
  plo.created_at,
  plo.itinerary_id,
  plo.user_id,
  plo.hold_reference,
  plo.hold_expires_at,
  plo.price_cents,
  plo.currency,
  plo.status,
  plo.consent_captured_at,
  plo.telemetry;

grant select on public.price_lock_offer_overview to authenticated;

grant select on public.price_lock_offer_overview to service_role;

create or replace view public.disruption_board_overview as
select
  db.id,
  db.created_at,
  db.itinerary_id,
  db.disruption_type,
  db.severity,
  db.status,
  db.occurred_at,
  db.resolved_at,
  db.notes,
  db.metadata
from growth.disruption_board db;

grant select on public.disruption_board_overview to authenticated;

grant select on public.disruption_board_overview to service_role;
