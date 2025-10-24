create or replace function public.group_payouts_counts(
  p_from timestamptz,
  p_to timestamptz
) returns table(status text, currency text, count bigint)
language sql
security definer
set search_path = "group", public
as $$
  select status,
         currency,
         count(*)::bigint as count
  from "group".payouts
  where (p_from is null or created_at >= p_from)
    and (p_to is null or created_at <= p_to)
  group by status, currency
  order by status, currency;
$$;

grant execute on function public.group_payouts_counts(timestamptz, timestamptz)
  to authenticated;

grant execute on function public.group_payouts_counts(timestamptz, timestamptz)
  to anon;
