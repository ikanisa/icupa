alter table "group".groups enable row level security;

create policy p_groups_owner_all on "group".groups
  using (owner = auth.uid())
  with check (owner = auth.uid());
