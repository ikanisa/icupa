-- Revert CFO pending journal update policy
-- Removes the approval workflow update capability.
drop policy if exists cfo_pending_journals_update on public.pending_journals;
