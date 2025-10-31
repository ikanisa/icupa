-- Real Estate Agent Schema
-- Phase 1: Database layer for listings, contacts, leads, matches, comms, consents, and embeddings
-- Migration: 20251030120000_real_estate_agent_schema.sql

set search_path = public, extensions;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable pgvector for embeddings (already enabled in bootstrap, but ensuring it's available)
do $$
begin
  -- Supabase's Postgres images expose the vector extension under either "pgvector" or "vector".
  if exists (select 1 from pg_available_extensions where name = 'pgvector') then
    execute 'create extension if not exists "pgvector"';
  else
    execute 'create extension if not exists "vector"';
  end if;
end;
$$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Provenance of data sources (websites, APIs, etc.)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  tos_url text,
  robots_txt text,
  crawl_policy jsonb,
  contact_channel text,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.sources is 'Tracks provenance and scraping policy for external data sources';
comment on column public.sources.domain is 'Source domain (e.g., realtor.com.mt)';
comment on column public.sources.crawl_policy is 'JSON policy rules: rate limits, allowed paths, etc.';

-- Canonical real estate listings
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  external_id text,
  url text,
  title text,
  description text,
  type text, -- "apartment", "house", "studio", "villa", etc.
  longlet_bool boolean default true,
  shortlet_bool boolean default false,
  location_text text,
  lat double precision,
  lng double precision,
  price_eur numeric,
  beds int,
  baths int,
  area_m2 numeric,
  furnished boolean,
  pets boolean,
  amenities jsonb,
  photos jsonb,
  available_from date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  owner_contact_id uuid
);

comment on table public.listings is 'Canonical real estate listings aggregated from various sources';
comment on column public.listings.external_id is 'Original ID from source system';
comment on column public.listings.type is 'Property type: apartment, house, studio, villa, etc.';
comment on column public.listings.longlet_bool is 'Available for long-term rental (6+ months)';
comment on column public.listings.shortlet_bool is 'Available for short-term rental';
comment on column public.listings.amenities is 'JSON array of amenities (e.g., ["wifi", "parking", "pool"])';
comment on column public.listings.photos is 'JSON array of photo URLs';

-- People and agencies (owners, agents, seekers)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('individual', 'agency')) not null,
  name text,
  phone text,
  email text,
  whatsapp_waid text, -- WhatsApp ID in international format (e.g., 35699123456)
  consent_status text check (consent_status in ('pending', 'granted', 'denied')) default 'pending',
  consent_notes text,
  last_verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.contacts is 'People and agencies involved in real estate transactions';
comment on column public.contacts.kind is 'Type of contact: individual or agency';
comment on column public.contacts.whatsapp_waid is 'WhatsApp phone number in international format';
comment on column public.contacts.consent_status is 'GDPR consent status for communications';

-- Property owners with verification status
create table if not exists public.owners (
  id uuid primary key references public.contacts(id) on delete cascade,
  proof_status text check (proof_status in ('unverified', 'verified')) default 'unverified',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.owners is 'Property owners with verification status';
comment on column public.owners.proof_status is 'Ownership verification status';

-- Seeker requests (people looking for properties)
create table if not exists public.lead_requests (
  id uuid primary key default gen_random_uuid(),
  seeker_contact_id uuid references public.contacts(id) on delete set null,
  prefs jsonb,
  budget_min numeric,
  budget_max numeric,
  locations text[],
  long_or_short text check (long_or_short in ('long', 'short')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.lead_requests is 'Property search requests from seekers';
comment on column public.lead_requests.prefs is 'Additional preferences as JSON (beds, baths, amenities, etc.)';
comment on column public.lead_requests.locations is 'Array of preferred location names or areas';
comment on column public.lead_requests.long_or_short is 'Rental duration preference';

-- Matching results between requests and listings
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  lead_request_id uuid references public.lead_requests(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  score double precision,
  reasons jsonb,
  status text check (status in (
    'pending_owner',
    'owner_busy',
    'owner_declined',
    'owner_engaged',
    'proposed_to_seeker',
    'accepted',
    'rejected'
  )) default 'pending_owner',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.matches is 'Matching results between seeker requests and listings';
comment on column public.matches.score is 'Match quality score (0.0 to 1.0)';
comment on column public.matches.reasons is 'JSON array of matching reasons';
comment on column public.matches.status is 'Current status in the matching workflow';

-- Communications log (WhatsApp, SIP calls, email)
create table if not exists public.comms (
  id uuid primary key default gen_random_uuid(),
  channel text check (channel in ('whatsapp', 'sip', 'email')),
  direction text check (direction in ('outbound', 'inbound')) not null,
  listing_id uuid references public.listings(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  thread_id text,
  transcript text,
  media jsonb,
  consent_snapshot jsonb,
  started_at timestamptz default now(),
  ended_at timestamptz
);

comment on table public.comms is 'Communication log for all channels (WhatsApp, SIP, email)';
comment on column public.comms.channel is 'Communication channel used';
comment on column public.comms.direction is 'Inbound or outbound communication';
comment on column public.comms.thread_id is 'Thread or conversation ID for grouping related messages';
comment on column public.comms.transcript is 'Full text transcript of the communication';
comment on column public.comms.media is 'JSON array of media attachments (URLs, types)';
comment on column public.comms.consent_snapshot is 'Snapshot of consent status at time of communication';

-- Explicit consent records for GDPR compliance
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  channel text,
  purpose text,
  granted_bool boolean,
  timestamp timestamptz default now(),
  evidence jsonb
);

comment on table public.consents is 'Explicit consent records for GDPR compliance';
comment on column public.consents.channel is 'Channel consent applies to (whatsapp, sip, email, etc.)';
comment on column public.consents.purpose is 'Purpose of data processing (e.g., "property matching", "marketing")';
comment on column public.consents.granted_bool is 'Whether consent was granted or denied';
comment on column public.consents.evidence is 'JSON evidence of consent (timestamp, method, IP, etc.)';

-- Embeddings for semantic search
create table if not exists public.embeddings (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  vector vector(1536), -- OpenAI text-embedding-ada-002 or text-embedding-3-small
  chunk text,
  model text default 'text-embedding-3-small',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.embeddings is 'Vector embeddings for semantic search of listings';
comment on column public.embeddings.vector is 'Vector embedding (1536 dimensions for OpenAI ada-002/3-small)';
comment on column public.embeddings.chunk is 'Text chunk that was embedded (title + description + amenities)';
comment on column public.embeddings.model is 'Embedding model used';

-- =============================================================================
-- INDICES
-- =============================================================================

-- Listings indices for common queries
create index if not exists idx_listings_price on public.listings(price_eur) where price_eur is not null;
create index if not exists idx_listings_geo on public.listings(lat, lng) where lat is not null and lng is not null;
create index if not exists idx_listings_updated on public.listings(updated_at desc);
create index if not exists idx_listings_type on public.listings(type) where type is not null;
create index if not exists idx_listings_source on public.listings(source_id) where source_id is not null;
create index if not exists idx_listings_available on public.listings(available_from) where available_from is not null;

-- Unique constraint on source + external_id for deduplication
create unique index if not exists idx_listings_source_external 
  on public.listings(source_id, external_id) 
  where source_id is not null and external_id is not null;

-- Contacts indices
create index if not exists idx_contacts_email on public.contacts(email) where email is not null;
create index if not exists idx_contacts_phone on public.contacts(phone) where phone is not null;
create index if not exists idx_contacts_whatsapp on public.contacts(whatsapp_waid) where whatsapp_waid is not null;

-- Matches indices
create index if not exists idx_matches_request on public.matches(lead_request_id);
create index if not exists idx_matches_listing on public.matches(listing_id);
create index if not exists idx_matches_score on public.matches(score desc) where score is not null;
create index if not exists idx_matches_status on public.matches(status);

-- Comms indices
create index if not exists idx_comms_contact on public.comms(contact_id);
create index if not exists idx_comms_listing on public.comms(listing_id);
create index if not exists idx_comms_thread on public.comms(thread_id) where thread_id is not null;
create index if not exists idx_comms_started on public.comms(started_at desc);

-- Consents indices
create index if not exists idx_consents_contact on public.consents(contact_id);
create index if not exists idx_consents_timestamp on public.consents(timestamp desc);

-- Vector similarity search index (IVFFlat for performance)
create index if not exists idx_embeddings_vector 
  on public.embeddings 
  using ivfflat (vector vector_cosine_ops)
  with (lists = 100);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
alter table public.sources enable row level security;
alter table public.listings enable row level security;
alter table public.contacts enable row level security;
alter table public.owners enable row level security;
alter table public.lead_requests enable row level security;
alter table public.matches enable row level security;
alter table public.comms enable row level security;
alter table public.consents enable row level security;
alter table public.embeddings enable row level security;

-- Conservative policies for operators (authenticated users with appropriate roles)
-- Note: These are permissive initial policies. Tighten based on your auth model.

-- Operators can read all listings
create policy "operators_read_listings" 
  on public.listings 
  for select 
  using (true);

-- Operators can read all contacts
create policy "operators_read_contacts" 
  on public.contacts 
  for select 
  using (true);

-- Operators can read all lead requests
create policy "operators_read_lead_requests" 
  on public.lead_requests 
  for select 
  using (true);

-- Operators can read all matches
create policy "operators_read_matches" 
  on public.matches 
  for select 
  using (true);

-- Operators can read all comms
create policy "operators_read_comms" 
  on public.comms 
  for select 
  using (true);

-- Operators can read all consents
create policy "operators_read_consents" 
  on public.consents 
  for select 
  using (true);

-- Operators can read embeddings (for debugging)
create policy "operators_read_embeddings" 
  on public.embeddings 
  for select 
  using (true);

-- Sources are readable by all (for transparency)
create policy "public_read_sources" 
  on public.sources 
  for select 
  using (true);

-- Service role can do everything (for Edge Functions)
-- These policies use the authenticated() function, but service_role bypasses RLS anyway
-- Explicit policies for insert/update/delete can be added as needed

comment on policy "operators_read_listings" on public.listings is 'Allow authenticated users to read listings';
comment on policy "operators_read_matches" on public.matches is 'Allow authenticated users to read matches';
