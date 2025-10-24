-- Supplier CRM primitives for provider relationship management
create schema if not exists supplier_crm;

create table if not exists supplier_crm.providers (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  name text not null,
  status text not null default 'prospect',
  region text,
  notes text,
  tags text[] not null default '{}',
  last_contacted_at timestamptz,
  primary_contact_id uuid,
  constraint provider_status_check
    check (status in ('prospect', 'active', 'inactive', 'paused'))
);

comment on table supplier_crm.providers is 'Vetted suppliers tracked by the ops promise board.';
comment on column supplier_crm.providers.tags is 'Free-form labels applied by ops (e.g., priority regions).';

create table if not exists supplier_crm.contacts (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references supplier_crm.providers (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  full_name text not null,
  email text,
  phone text,
  role text,
  whatsapp text,
  notes text,
  is_primary boolean not null default false,
  last_outbound_at timestamptz
);

comment on table supplier_crm.contacts is 'Supplier stakeholders that ops communicates with (email, phone, WA).';
comment on column supplier_crm.contacts.is_primary is 'True when this contact receives promise board escalations.';

alter table supplier_crm.providers
  add constraint providers_primary_contact_fk
  foreign key (primary_contact_id) references supplier_crm.contacts (id) on delete set null;

create table if not exists supplier_crm.threads (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references supplier_crm.providers (id) on delete set null,
  contact_id uuid references supplier_crm.contacts (id) on delete set null,
  channel text not null default 'email',
  subject text not null,
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_outbound_at timestamptz,
  last_inbound_at timestamptz,
  promise_column text,
  constraint thread_channel_check check (channel in ('email', 'whatsapp', 'phone', 'task')),
  constraint thread_status_check check (status in ('open', 'snoozed', 'closed'))
);

comment on table supplier_crm.threads is 'Conversation threads for supplier promise board follow-ups.';
comment on column supplier_crm.threads.promise_column is 'Promise board column captured when screenshotting status.';

create table if not exists supplier_crm.messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references supplier_crm.threads (id) on delete cascade,
  provider_id uuid references supplier_crm.providers (id) on delete set null,
  contact_id uuid references supplier_crm.contacts (id) on delete set null,
  direction text not null,
  subject text,
  body text,
  sent_at timestamptz not null default timezone('utc', now()),
  delivery_status text not null default 'queued',
  delivery_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table supplier_crm.messages is 'Raw supplier CRM message ledger (email + omni-channel).';
comment on column supplier_crm.messages.direction is 'outbound when ops sends, inbound for supplier replies.';

alter table supplier_crm.messages
  add constraint messages_direction_check check (direction in ('outbound', 'inbound'));

create table if not exists supplier_crm.contact_templates (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  label text not null,
  subject text not null,
  body_preview text not null,
  channel text not null default 'email',
  usage_columns text[] not null default '{}',
  screenshot_hint text
);

comment on table supplier_crm.contact_templates is 'Pre-approved outreach templates surfaced in ops consoles.';
comment on column supplier_crm.contact_templates.usage_columns is 'Booking columns referenced by the template merge fields.';

-- RLS: service role writes, ops console reads via service role access only
alter table supplier_crm.providers enable row level security;
alter table supplier_crm.contacts enable row level security;
alter table supplier_crm.threads enable row level security;
alter table supplier_crm.messages enable row level security;
alter table supplier_crm.contact_templates enable row level security;

revoke all on supplier_crm.providers from anon;
revoke all on supplier_crm.providers from authenticated;
revoke all on supplier_crm.contacts from anon;
revoke all on supplier_crm.contacts from authenticated;
revoke all on supplier_crm.threads from anon;
revoke all on supplier_crm.threads from authenticated;
revoke all on supplier_crm.messages from anon;
revoke all on supplier_crm.messages from authenticated;
revoke all on supplier_crm.contact_templates from anon;
revoke all on supplier_crm.contact_templates from authenticated;

create policy supplier_providers_service_only on supplier_crm.providers
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy supplier_contacts_service_only on supplier_crm.contacts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy supplier_threads_service_only on supplier_crm.threads
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy supplier_messages_service_only on supplier_crm.messages
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy supplier_contact_templates_service_only on supplier_crm.contact_templates
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant usage on schema supplier_crm to service_role;
grant select, insert, update, delete on all tables in schema supplier_crm to service_role;
