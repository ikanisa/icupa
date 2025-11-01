-- CFO can update pending journals during approval workflow
-- Ensures approval edge function can persist status changes and notes.
drop policy if exists cfo_pending_journals_update on public.pending_journals;
create policy cfo_pending_journals_update on public.pending_journals
  for update
  using (current_role = 'cfo_agent')
  with check (current_role = 'cfo_agent');
