-- Tighten RLS for key domains touched by edge functions

create schema if not exists _ops;

-- Helper to enable RLS and create a service-role-only policy when missing
create or replace function _ops.ensure_service_policy(
  schema_name text,
  table_name text,
  policy_name text
) returns void as $$
declare
  qualified text := format('%I.%I', schema_name, table_name);
  existing boolean;
begin
  execute format('select to_regclass(%L)', qualified) into existing;
  if not existing then
    return;
  end if;

  execute format('alter table %s enable row level security', qualified);

  if not exists (
    select 1
    from pg_policies
    where schemaname = schema_name
      and tablename = table_name
      and policyname = policy_name
  ) then
    execute format(
      'create policy %I on %s for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      policy_name,
      qualified
    );
  end if;
end;
$$ language plpgsql;

select _ops.ensure_service_policy('payment', 'payments', 'p_payment_service_only');
select _ops.ensure_service_policy('fin', 'ledger', 'p_fin_ledger_service_only');
select _ops.ensure_service_policy('fin', 'invoices', 'p_fin_invoices_service_only');
select _ops.ensure_service_policy('privacy', 'requests', 'p_privacy_requests_service_only');
select _ops.ensure_service_policy('privacy', 'datamap', 'p_privacy_datamap_service_only');

-- clean up helper to avoid leaking into public schema
 drop function if exists _ops.ensure_service_policy(text, text, text);
