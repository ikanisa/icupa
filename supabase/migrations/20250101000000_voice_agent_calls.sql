-- Voice Agent: Create calls table for storing call events and metadata
-- This table stores information about voice calls handled by the Twilio/OpenAI integration

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  from_number text not null,
  to_number text not null,
  call_sid text,
  transcript text,
  intent text,
  duration integer,
  status text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_calls_from_number on public.calls(from_number);
create index if not exists idx_calls_to_number on public.calls(to_number);
create index if not exists idx_calls_call_sid on public.calls(call_sid);
create index if not exists idx_calls_created_at on public.calls(created_at desc);
create index if not exists idx_calls_status on public.calls(status) where status is not null;

-- Enable Row Level Security
alter table public.calls enable row level security;

-- Policy: Allow service role to manage all records
create policy "Service role can manage all calls"
  on public.calls
  for all
  to service_role
  using (true)
  with check (true);

-- Policy: Allow authenticated users to read their own calls
-- Assumes from_number or to_number contains user's phone
create policy "Users can read their own calls"
  on public.calls
  for select
  to authenticated
  using (
    auth.jwt() ->> 'phone' = from_number 
    or auth.jwt() ->> 'phone' = to_number
  );

-- Add comment for documentation
comment on table public.calls is 'Voice call records from Twilio/OpenAI Realtime integration';
comment on column public.calls.from_number is 'Caller phone number in E.164 format';
comment on column public.calls.to_number is 'Recipient phone number in E.164 format';
comment on column public.calls.call_sid is 'Twilio call SID for reference';
comment on column public.calls.transcript is 'Call transcript from speech recognition';
comment on column public.calls.intent is 'Detected user intent from conversation';
comment on column public.calls.duration is 'Call duration in seconds';
comment on column public.calls.status is 'Call status: completed, failed, in_progress, etc.';
comment on column public.calls.meta is 'Additional metadata in JSON format';
