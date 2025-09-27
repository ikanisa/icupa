set search_path = public;

-- Provide a safe helper to increment promo spend while respecting staff access
-- and the configured budget cap.
create or replace function public.increment_promo_spend(
  campaign_id uuid,
  delta_cents integer
)
returns public.promo_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.promo_campaigns;
  previous_spent integer;
  next_spent integer;
  actor uuid;
begin
  if delta_cents is null or delta_cents <= 0 then
    raise exception using message = 'delta_cents must be a positive integer';
  end if;

  select * into current_row
  from public.promo_campaigns
  where id = campaign_id
  for update;

  if not found then
    raise exception using message = format('Promo campaign %s was not found', campaign_id);
  end if;

  actor := auth.uid();
  if not is_staff_for_tenant(current_row.tenant_id, array['owner','manager','cashier','admin']::role_t[]) then
    raise exception using message = 'Permission denied for promo spend update';
  end if;

  previous_spent := current_row.spent_cents;
  next_spent := previous_spent + delta_cents;
  if next_spent > current_row.budget_cap_cents then
    next_spent := current_row.budget_cap_cents;
  end if;

  update public.promo_campaigns
     set spent_cents = next_spent
   where id = campaign_id
   returning * into current_row;

  insert into public.promo_audit_events (campaign_id, action, detail, created_by)
  values (
    campaign_id,
    'spend:increment',
    jsonb_build_object(
      'delta_cents', delta_cents,
      'previous_spent_cents', previous_spent,
      'new_spent_cents', next_spent,
      'budget_cap_cents', current_row.budget_cap_cents,
      'was_capped', next_spent = current_row.budget_cap_cents and previous_spent + delta_cents > current_row.budget_cap_cents
    ),
    actor
  );

  return current_row;
end;
$$;

grant execute on function public.increment_promo_spend(uuid, integer) to authenticated;
