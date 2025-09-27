create or replace function public.update_group_escrow_status(
  p_escrow uuid,
  p_status text,
  p_paid_out_at timestamptz default null
) returns "group".escrows
language plpgsql
security definer
set search_path = "group", public
as $$
declare
  updated "group".escrows;
begin
  update "group".escrows
     set status = p_status,
         paid_out_at = coalesce(p_paid_out_at, paid_out_at)
   where id = p_escrow
  returning * into updated;
  return updated;
end;
$$;

grant execute on function public.update_group_escrow_status(uuid, text, timestamptz)
  to authenticated;

grant execute on function public.update_group_escrow_status(uuid, text, timestamptz)
  to anon;
