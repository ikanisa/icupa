-- Pragmatic remote DB repair helpers for hosted environments
-- Use in the Supabase SQL Editor when migrations drift or partial states exist.
-- Safely creates missing objects if they do not already exist.

set search_path = public, extensions;

-- merchant_profiles table (if missing)
do $$
begin
  if to_regclass('public.merchant_profiles') is null then
    create table public.merchant_profiles (
      user_id uuid primary key references auth.users(id) on delete cascade,
      tenant_id uuid references public.tenants(id) on delete set null,
      role text,
      display_name text,
      phone text,
      metadata jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default timezone('utc', now()),
      created_at timestamptz not null default timezone('utc', now())
    );

    create index if not exists merchant_profiles_tenant_idx on public.merchant_profiles(tenant_id);

    create or replace function public.touch_merchant_profiles()
    returns trigger
    language plpgsql
    as $$
    begin
      new.updated_at := timezone('utc', now());
      return new;
    end;
    $$;

    drop trigger if exists trg_touch_merchant_profiles on public.merchant_profiles;
    create trigger trg_touch_merchant_profiles
      before update on public.merchant_profiles
      for each row execute function public.touch_merchant_profiles();

    alter table public.merchant_profiles enable row level security;
    drop policy if exists "merchant self-read" on public.merchant_profiles;
    create policy "merchant self-read" on public.merchant_profiles
      for select using (auth.uid() = user_id or auth.role() = 'service_role');

    drop policy if exists "merchant self-update" on public.merchant_profiles;
    create policy "merchant self-update" on public.merchant_profiles
      for update using (auth.uid() = user_id or auth.role() = 'service_role')
      with check (auth.uid() = user_id or auth.role() = 'service_role');

    drop policy if exists "service role manage" on public.merchant_profiles;
    create policy "service role manage" on public.merchant_profiles
      for all using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

-- run_payment_reconciliation RPC (if missing)
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'run_payment_reconciliation' and n.nspname = 'public'
  ) then
    create or replace function public.run_payment_reconciliation(p_window_start date, p_window_end date)
    returns void
    language plpgsql
    security definer
    set search_path = public, extensions
    as $$
    declare
      captured_total bigint;
      failed_count integer;
      pending_count integer;
    begin
      select coalesce(sum(amount_cents), 0)
        into captured_total
        from public.payments
        where status = 'captured'
          and created_at >= p_window_start
          and created_at < p_window_end + interval '1 day';

      select count(*)
        into failed_count
        from public.payments
        where status = 'failed'
          and created_at >= p_window_start
          and created_at < p_window_end + interval '1 day';

      select count(*)
        into pending_count
        from public.payments
        where status = 'pending'
          and created_at < p_window_end + interval '1 day';

      insert into public.payment_reconciliation_runs (
        coverage_start,
        coverage_end,
        total_captured_cents,
        total_failed,
        pending_payments,
        status,
        notes,
        completed_at
      )
      values (
        p_window_start,
        p_window_end,
        captured_total,
        failed_count,
        pending_count,
        'completed',
        null,
        timezone('utc', now())
      );
    end;
    $$;

    grant execute on function public.run_payment_reconciliation(date, date) to service_role;
  end if;
end
$$;

-- receipts queue helpers (if missing)
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.proname='dequeue_fiscalization_job' and n.nspname='public'
  ) then
    -- Fallback queue table when pgmq is unavailable
    if to_regclass('public.fiscalization_queue') is null then
      create table public.fiscalization_queue (
        msg_id bigserial primary key,
        order_id uuid not null,
        payment_id uuid not null,
        visible_at timestamptz,
        enqueued_at timestamptz not null default timezone('utc', now())
      );
    end if;

    create or replace function public.dequeue_fiscalization_job(visibility_timeout_seconds integer default 60)
    returns table(msg_id bigint, order_id uuid, payment_id uuid, enqueued_at timestamptz)
    language plpgsql as $$
    begin
      return query
      select q.msg_id, q.order_id, q.payment_id, q.enqueued_at
      from public.fiscalization_queue q
      where (q.visible_at is null or q.visible_at <= now())
      order by q.msg_id asc
      limit 1;
    end;
    $$;
    grant execute on function public.dequeue_fiscalization_job(integer) to service_role;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.proname='delete_fiscalization_job' and n.nspname='public'
  ) then
    create or replace function public.delete_fiscalization_job(msg_id bigint)
    returns void
    language plpgsql as $$
    begin
      delete from public.fiscalization_queue where msg_id = delete_fiscalization_job.msg_id;
    end;
    $$;
    grant execute on function public.delete_fiscalization_job(bigint) to service_role;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.proname='enqueue_fiscalization_job' and n.nspname='public'
  ) then
    create or replace function public.enqueue_fiscalization_job(order_uuid uuid, payment_uuid uuid)
    returns bigint
    language plpgsql as $$
    declare new_id bigint;
    begin
      if order_uuid is null or payment_uuid is null then
        raise exception 'order_uuid and payment_uuid must be provided';
      end if;
      insert into public.fiscalization_queue(order_id, payment_id)
      values (order_uuid, payment_uuid)
      returning msg_id into new_id;
      return new_id;
    end;
    $$;
    grant execute on function public.enqueue_fiscalization_job(uuid, uuid) to service_role;
  end if;
end
$$;
