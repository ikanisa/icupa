-- Rollback migration for voice agent calls table

drop policy if exists "Users can read their own calls" on public.calls;
drop policy if exists "Service role can manage all calls" on public.calls;

drop index if exists public.idx_calls_status;
drop index if exists public.idx_calls_created_at;
drop index if exists public.idx_calls_call_sid;
drop index if exists public.idx_calls_to_number;
drop index if exists public.idx_calls_from_number;

drop table if exists public.calls;
