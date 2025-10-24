-- Depends on group schema and security helpers from 0012_groups_splitpay.sql and 0009_ops_views_and_policies.sql
create table if not exists "group".match_candidates (
  id uuid primary key default gen_random_uuid(),
  anchor_group_id uuid not null references "group".groups(id) on delete cascade,
  candidate_group_id uuid not null references "group".groups(id) on delete cascade,
  similarity numeric not null default 0 check (similarity >= 0 and similarity <= 1),
  overlap_members int not null default 0 check (overlap_members >= 0),
  shared_itineraries uuid[] not null default '{}'::uuid[],
  signals jsonb not null default '[]'::jsonb,
  status text not null default 'new' check (status in ('new','in_review','confirmed','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anchor_group_id, candidate_group_id),
  check (anchor_group_id <> candidate_group_id)
);

create or replace function "group".set_match_candidates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_group_match_candidates_updated_at'
      and tgrelid = '"group".match_candidates'::regclass
  ) then
    create trigger trg_group_match_candidates_updated_at
      before update on "group".match_candidates
      for each row
      execute function "group".set_match_candidates_updated_at();
  end if;
end
$$;

create index if not exists idx_group_match_candidates_anchor
  on "group".match_candidates(anchor_group_id);

create index if not exists idx_group_match_candidates_candidate
  on "group".match_candidates(candidate_group_id);

alter table "group".match_candidates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_candidates_select'
      and schemaname = 'group'
      and tablename = 'match_candidates'
  ) then
    create policy p_group_match_candidates_select on "group".match_candidates
      for select
      using (
        sec.is_ops(auth.uid()) or
        exists (
          select 1
          from "group".members m
          where m.group_id = "group".match_candidates.anchor_group_id
            and m.user_id = auth.uid()
        ) or
        exists (
          select 1
          from "group".members m
          where m.group_id = "group".match_candidates.candidate_group_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_candidates_insert_ops'
      and schemaname = 'group'
      and tablename = 'match_candidates'
  ) then
    create policy p_group_match_candidates_insert_ops on "group".match_candidates
      for insert
      with check (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_candidates_update_ops'
      and schemaname = 'group'
      and tablename = 'match_candidates'
  ) then
    create policy p_group_match_candidates_update_ops on "group".match_candidates
      for update
      using (sec.is_ops(auth.uid()))
      with check (sec.is_ops(auth.uid()));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_candidates_delete_ops'
      and schemaname = 'group'
      and tablename = 'match_candidates'
  ) then
    create policy p_group_match_candidates_delete_ops on "group".match_candidates
      for delete
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

create table if not exists "group".match_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references "group".match_candidates(id) on delete cascade,
  actor_user_id uuid not null default auth.uid(),
  actor_role text not null default 'member' check (actor_role in ('ops','owner','member')),
  decision text not null check (decision in ('confirm','dismiss','duplicate','flag')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_match_feedback_match
  on "group".match_feedback(match_id);

alter table "group".match_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_feedback_select'
      and schemaname = 'group'
      and tablename = 'match_feedback'
  ) then
    create policy p_group_match_feedback_select on "group".match_feedback
      for select
      using (
        sec.is_ops(auth.uid()) or exists (
          select 1
          from "group".match_candidates mc
          join "group".members m
            on m.group_id = mc.anchor_group_id or m.group_id = mc.candidate_group_id
          where mc.id = "group".match_feedback.match_id
            and m.user_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_feedback_insert'
      and schemaname = 'group'
      and tablename = 'match_feedback'
  ) then
    create policy p_group_match_feedback_insert on "group".match_feedback
      for insert
      with check (
        (
          sec.is_ops(auth.uid())
          and "group".match_feedback.actor_user_id = auth.uid()
          and "group".match_feedback.actor_role = 'ops'
        ) or (
          exists (
            select 1
            from "group".match_candidates mc
            join "group".members m
              on m.group_id = mc.anchor_group_id or m.group_id = mc.candidate_group_id
            where mc.id = "group".match_feedback.match_id
              and m.user_id = auth.uid()
              and m.role = 'owner'
          )
          and "group".match_feedback.actor_user_id = auth.uid()
          and "group".match_feedback.actor_role in ('owner', 'member')
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where policyname = 'p_group_match_feedback_delete_ops'
      and schemaname = 'group'
      and tablename = 'match_feedback'
  ) then
    create policy p_group_match_feedback_delete_ops on "group".match_feedback
      for delete
      using (sec.is_ops(auth.uid()));
  end if;
end
$$;

grant select on "group".match_candidates to authenticated;

grant select, insert on "group".match_feedback to authenticated;

grant all on "group".match_candidates to service_role;

grant all on "group".match_feedback to service_role;
