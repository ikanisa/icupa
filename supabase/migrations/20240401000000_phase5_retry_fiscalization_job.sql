-- Phase 5: allow staff to retry fiscalisation jobs manually
create or replace function public.retry_fiscalization_job(order_uuid uuid, payment_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pgmq
as $$
declare
  target_tenant uuid;
  message_id bigint;
begin
  if order_uuid is null or payment_uuid is null then
    raise exception 'order_uuid and payment_uuid must be provided';
  end if;

  select tenant_id
    into target_tenant
    from public.orders
   where id = order_uuid;

  if target_tenant is null then
    raise exception 'order_not_found';
  end if;

  if not is_staff_for_tenant(target_tenant, array['owner','manager','cashier','admin']::role_t[]) then
    raise exception 'permission_denied';
  end if;

  message_id := public.enqueue_fiscalization_job(order_uuid, payment_uuid);

  return jsonb_build_object('msg_id', message_id);
end;
$$;

grant execute on function public.retry_fiscalization_job(uuid, uuid) to authenticated;
