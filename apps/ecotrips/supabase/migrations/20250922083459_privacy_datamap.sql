create schema if not exists privacy;

create table if not exists privacy.data_map (
  id bigserial primary key,
  schema_name text not null,
  table_name text not null,
  pk_column text not null,
  subject_column text not null,
  subject_source text not null default 'direct',
  pii_columns text[] not null default '{}',
  erasure_action text not null default 'delete' check (erasure_action in ('delete','redact')),
  redact_columns text[] not null default '{}',
  retention_days int default null,
  notes text
);

create unique index if not exists idx_privacy_data_map_table
  on privacy.data_map(schema_name, table_name);

insert into privacy.data_map (schema_name, table_name, pk_column, subject_column, subject_source, pii_columns, erasure_action, redact_columns, retention_days, notes)
values
  ('core', 'profiles', 'id', 'auth_user_id', 'direct', array['auth_user_id','persona'], 'delete', array[]::text[], null, 'Auth-linked profile record'),
  ('agents', 'messages', 'id', 'user_id', 'direct', array['user_wa','body'], 'redact', array['user_wa','body'], 30, 'WhatsApp transcript payload'),
  ('booking', 'itineraries', 'id', 'user_id', 'direct', array['user_id','notes'], 'delete', array[]::text[], null, 'Trip itineraries per user'),
  ('booking', 'items', 'id', 'itinerary_id', 'itinerary', array['pax','supplier_ref'], 'delete', array[]::text[], null, 'Itinerary line items'),
  ('payment', 'payments', 'id', 'id', 'payment_self', array['idempotency_key','provider_ref','status'], 'redact', array['idempotency_key','provider_ref','itinerary_id','status'], 2555, 'Payment ledger (retain amounts)'),
  ('group', 'members', 'id', 'user_id', 'direct', array['user_id'], 'delete', array[]::text[], null, 'Group membership assignments'),
  ('group', 'escrows', 'id', 'group_id', 'group', array['itinerary_id'], 'redact', array['itinerary_id'], 365, 'Escrow metadata (retain totals)'),
  ('group', 'contributions', 'id', 'member_id', 'member', array['amount_cents','currency'], 'delete', array[]::text[], null, 'Member contributions'),
  ('fin', 'invoices', 'id', 'payment_id', 'payment', array['storage_path'], 'redact', array['storage_path','payment_id','itinerary_id'], 3650, 'Invoice metadata (retain number)'),
  ('fin', 'ledger', 'id', 'payment_id', 'payment', array['note','provider_ref'], 'redact', array['note','provider_ref'], 3650, 'Financial ledger entries (retain amounts)')
  on conflict do nothing;

create table if not exists privacy.requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('export','erasure')),
  requester_user_id uuid,
  subject_user_id uuid not null,
  status text not null default 'received' check (status in ('received','in_review','approved','processing','completed','rejected','failed')),
  reason text,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_privacy_requests_subject on privacy.requests(subject_user_id);
create index if not exists idx_privacy_requests_status on privacy.requests(status);

create or replace function privacy.requests_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_privacy_requests_updated on privacy.requests;

create trigger trg_privacy_requests_updated
before update on privacy.requests
for each row execute procedure privacy.requests_touch_updated_at();

alter table privacy.requests enable row level security;

grant usage on schema privacy to service_role;

grant select, insert, update, delete on privacy.data_map to service_role;

grant select, insert, update, delete on privacy.requests to service_role;

grant usage on all sequences in schema privacy to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'privacy' and tablename = 'requests' and policyname = 'p_privacy_requests_subject_read'
  ) then
    create policy p_privacy_requests_subject_read on privacy.requests
      for select using (coalesce(auth.uid(), gen_random_uuid()) = subject_user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'privacy' and tablename = 'requests' and policyname = 'p_privacy_requests_service_all'
  ) then
    create policy p_privacy_requests_service_all on privacy.requests
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end;
$$;

create or replace function public.privacy_subject_context(p_subject uuid)
returns table(
  itinerary_ids uuid[],
  group_ids uuid[],
  member_ids uuid[],
  escrow_ids uuid[],
  payment_ids uuid[]
)
language plpgsql
security definer
set search_path = public, privacy
as $$
begin
  select coalesce(array_agg(id), '{}'::uuid[]) into itinerary_ids
    from booking.itineraries where user_id = p_subject;

  select coalesce(array_agg(distinct group_id), '{}'::uuid[]) into group_ids
    from "group".members where user_id = p_subject;

  select coalesce(array_agg(id), '{}'::uuid[]) into member_ids
    from "group".members where user_id = p_subject;

  select coalesce(array_agg(id), '{}'::uuid[]) into escrow_ids
    from "group".escrows where group_id = any(coalesce(group_ids, '{}'::uuid[]));

  select coalesce(array_agg(id), '{}'::uuid[]) into payment_ids
    from payment.payments where itinerary_id = any(coalesce(itinerary_ids, '{}'::uuid[]));

  return next;
end;
$$;

grant execute on function public.privacy_subject_context(uuid) to service_role;

create or replace function public.privacy_fetch_table(p_schema text, p_table text, p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.data_map%rowtype;
  ctx record;
  sql text;
  rows jsonb := '[]'::jsonb;
begin
  select * into rec from privacy.data_map where schema_name = p_schema and table_name = p_table;
  if not found then
    return rows;
  end if;

  select * into ctx from public.privacy_subject_context(p_subject);

  if rec.subject_source = 'direct' then
    sql := format('select row_to_json(t) from %I.%I t where %I = $1', rec.schema_name, rec.table_name, rec.subject_column);
    execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (%s) r', sql) into rows using p_subject;
  elsif rec.subject_source = 'itinerary' then
    if ctx.itinerary_ids is null or array_length(ctx.itinerary_ids, 1) is null then
      return rows;
    end if;
    sql := format('select row_to_json(t) from %I.%I t where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (%s) r', sql) into rows using ctx.itinerary_ids;
  elsif rec.subject_source = 'payment' then
    if ctx.payment_ids is null or array_length(ctx.payment_ids, 1) is null then
      return rows;
    end if;
    sql := format('select row_to_json(t) from %I.%I t where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (%s) r', sql) into rows using ctx.payment_ids;
  elsif rec.subject_source = 'payment_self' then
    if ctx.payment_ids is null or array_length(ctx.payment_ids, 1) is null then
      return rows;
    end if;
    sql := format('select row_to_json(t) from %I.%I t where %I = any($1)', rec.schema_name, rec.table_name, rec.pk_column);
    execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (%s) r', sql) into rows using ctx.payment_ids;
  elsif rec.subject_source = 'group' then
    if ctx.group_ids is null or array_length(ctx.group_ids, 1) is null then
      return rows;
    end if;
    sql := format('select row_to_json(t) from %I.%I t where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (%s) r', sql) into rows using ctx.group_ids;
  elsif rec.subject_source = 'member' then
    if ctx.member_ids is null or array_length(ctx.member_ids, 1) is null then
      return rows;
    end if;
    sql := format('select row_to_json(t) from %I.%I t where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (%s) r', sql) into rows using ctx.member_ids;
  else
    return rows;
  end if;

  return rows;
end;
$$;

grant execute on function public.privacy_fetch_table(text, text, uuid) to service_role;

create or replace function public.privacy_count_table(p_schema text, p_table text, p_subject uuid)
returns bigint
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.data_map%rowtype;
  ctx record;
  sql text;
  result bigint := 0;
begin
  select * into rec from privacy.data_map where schema_name = p_schema and table_name = p_table;
  if not found then
    return 0;
  end if;
  select * into ctx from public.privacy_subject_context(p_subject);

  if rec.subject_source = 'direct' then
    sql := format('select count(*) from %I.%I where %I = $1', rec.schema_name, rec.table_name, rec.subject_column);
    execute sql into result using p_subject;
  elsif rec.subject_source = 'itinerary' then
    if ctx.itinerary_ids is null or array_length(ctx.itinerary_ids,1) is null then return 0; end if;
    sql := format('select count(*) from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute sql into result using ctx.itinerary_ids;
  elsif rec.subject_source = 'payment' then
    if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then return 0; end if;
    sql := format('select count(*) from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute sql into result using ctx.payment_ids;
  elsif rec.subject_source = 'payment_self' then
    if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then return 0; end if;
    sql := format('select count(*) from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.pk_column);
    execute sql into result using ctx.payment_ids;
  elsif rec.subject_source = 'group' then
    if ctx.group_ids is null or array_length(ctx.group_ids,1) is null then return 0; end if;
    sql := format('select count(*) from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute sql into result using ctx.group_ids;
  elsif rec.subject_source = 'member' then
    if ctx.member_ids is null or array_length(ctx.member_ids,1) is null then return 0; end if;
    sql := format('select count(*) from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column);
    execute sql into result using ctx.member_ids;
  end if;
  return coalesce(result, 0);
end;
$$;

grant execute on function public.privacy_count_table(text, text, uuid) to service_role;

create or replace function public.privacy_create_request(
  p_kind text,
  p_requester uuid,
  p_subject uuid,
  p_reason text
)
returns privacy.requests
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  new_row privacy.requests;
begin
  insert into privacy.requests (kind, requester_user_id, subject_user_id, reason)
  values (p_kind, p_requester, p_subject, p_reason)
  returning * into new_row;
  return new_row;
end;
$$;

grant execute on function public.privacy_create_request(text, uuid, uuid, text) to service_role;

create or replace function public.privacy_get_request(p_request_id uuid)
returns privacy.requests
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.requests;
begin
  select * into rec from privacy.requests where id = p_request_id;
  return rec;
end;
$$;

grant execute on function public.privacy_get_request(uuid) to service_role;

create or replace function public.privacy_transition_request(
  p_request_id uuid,
  p_allowed_from text[],
  p_new_status text,
  p_decision_note text default null
)
returns privacy.requests
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.requests;
begin
  select * into rec from privacy.requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found';
  end if;
  if array_length(p_allowed_from,1) is not null and rec.status <> all(p_allowed_from) then
    raise exception 'invalid status transition from % to %', rec.status, p_new_status;
  end if;
  update privacy.requests
     set status = p_new_status,
         decision_note = coalesce(p_decision_note, decision_note)
   where id = p_request_id
  returning * into rec;
  return rec;
end;
$$;

grant execute on function public.privacy_transition_request(uuid, text[], text, text) to service_role;

create or replace function public.privacy_set_status(
  p_request_id uuid,
  p_status text
)
returns privacy.requests
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.requests;
begin
  update privacy.requests
     set status = p_status
   where id = p_request_id
  returning * into rec;
  return rec;
end;
$$;

grant execute on function public.privacy_set_status(uuid, text) to service_role;

create or replace function public.privacy_collect_export(p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.data_map%rowtype;
  data jsonb := jsonb_build_object();
  table_rows jsonb;
begin
  for rec in select * from privacy.data_map loop
    table_rows := public.privacy_fetch_table(rec.schema_name, rec.table_name, p_subject);
    data := data || jsonb_build_object(rec.table_name, table_rows);
  end loop;
  return jsonb_build_object('tables', data, 'generated_at', now());
end;
$$;

grant execute on function public.privacy_collect_export(uuid) to service_role;

create or replace function public.privacy_plan_counts(p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.data_map%rowtype;
  counts jsonb := jsonb_build_object();
  count_value bigint;
begin
  for rec in select * from privacy.data_map loop
    count_value := public.privacy_count_table(rec.schema_name, rec.table_name, p_subject);
    counts := counts || jsonb_build_object(rec.table_name, jsonb_build_object(
      'schema', rec.schema_name,
      'table', rec.table_name,
      'action', rec.erasure_action,
      'count', count_value,
      'redact_columns', rec.redact_columns
    ));
  end loop;
  return counts;
end;
$$;

grant execute on function public.privacy_plan_counts(uuid) to service_role;

create or replace function public.privacy_get_datamap()
returns setof privacy.data_map
language sql
security definer
set search_path = privacy, public
as $$
  select * from privacy.data_map;
$$;

grant execute on function public.privacy_get_datamap() to service_role;

create or replace function public.privacy_apply_erasure(p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = privacy, public
as $$
declare
  rec privacy.data_map%rowtype;
  ctx record;
  affected bigint;
  summary jsonb := jsonb_build_object();
begin
  select * into ctx from public.privacy_subject_context(p_subject);

  for rec in select * from privacy.data_map loop
    affected := 0;
    if rec.erasure_action = 'delete' then
      if rec.subject_source = 'direct' then
        execute format('delete from %I.%I where %I = $1', rec.schema_name, rec.table_name, rec.subject_column)
          using p_subject;
        get diagnostics affected = row_count;
      elsif rec.subject_source = 'itinerary' then
        if ctx.itinerary_ids is null or array_length(ctx.itinerary_ids,1) is null then
          affected := 0;
        else
          execute format('delete from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.itinerary_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.subject_source = 'payment' then
        if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then
          affected := 0;
        else
          execute format('delete from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.payment_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.subject_source = 'payment_self' then
        if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then
          affected := 0;
        else
          execute format('delete from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.pk_column)
            using ctx.payment_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.subject_source = 'group' then
        if ctx.group_ids is null or array_length(ctx.group_ids,1) is null then
          affected := 0;
        else
          execute format('delete from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.group_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.subject_source = 'member' then
        if ctx.member_ids is null or array_length(ctx.member_ids,1) is null then
          affected := 0;
        else
          execute format('delete from %I.%I where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.member_ids;
          get diagnostics affected = row_count;
        end if;
      end if;
    elsif rec.erasure_action = 'redact' then
      if rec.schema_name = 'agents' and rec.table_name = 'messages' then
        execute format('update %I.%I set user_wa = NULL, body = ''{}''::jsonb where %I = $1', rec.schema_name, rec.table_name, rec.subject_column)
          using p_subject;
        get diagnostics affected = row_count;
      elsif rec.schema_name = 'payment' and rec.table_name = 'payments' then
        if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then
          affected := 0;
        else
          execute format('update %I.%I set itinerary_id = NULL, idempotency_key = NULL, provider_ref = NULL, status = ''voided'' where %I = any($1)', rec.schema_name, rec.table_name, rec.pk_column)
            using ctx.payment_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.schema_name = 'group' and rec.table_name = 'escrows' then
        if ctx.group_ids is null or array_length(ctx.group_ids,1) is null then
          affected := 0;
        else
          execute format('update %I.%I set itinerary_id = NULL where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.group_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.schema_name = 'fin' and rec.table_name = 'invoices' then
        if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then
          affected := 0;
        else
          execute format('update %I.%I set storage_path = NULL, payment_id = NULL, itinerary_id = NULL where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.payment_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.schema_name = 'fin' and rec.table_name = 'ledger' then
        if ctx.payment_ids is null or array_length(ctx.payment_ids,1) is null then
          affected := 0;
        else
          execute format('update %I.%I set provider_ref = NULL, note = NULL where %I = any($1)', rec.schema_name, rec.table_name, rec.subject_column)
            using ctx.payment_ids;
          get diagnostics affected = row_count;
        end if;
      elsif rec.subject_source = 'direct' then
        if array_length(rec.redact_columns,1) is null then
          affected := 0;
        else
          execute format('update %I.%I set %s where %I = $1', rec.schema_name, rec.table_name,
            array_to_string(array(select format('%I = NULL', col) from unnest(rec.redact_columns) col), ', '), rec.subject_column)
            using p_subject;
          get diagnostics affected = row_count;
        end if;
      end if;
    end if;

    summary := summary || jsonb_build_object(rec.table_name, jsonb_build_object(
      'schema', rec.schema_name,
      'action', rec.erasure_action,
      'count', coalesce(affected, 0)
    ));
  end loop;

  return summary;
end;
$$;

grant execute on function public.privacy_apply_erasure(uuid) to service_role;

create or replace function public.privacy_log_audit(
  p_who uuid,
  p_what text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = audit, public
as $$
begin
  insert into audit.events(who, what, payload)
  values (p_who, p_what, coalesce(p_payload, '{}'::jsonb));
end;
$$;

grant execute on function public.privacy_log_audit(uuid, text, jsonb) to service_role;
