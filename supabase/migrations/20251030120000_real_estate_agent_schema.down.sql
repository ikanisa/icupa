-- Rollback migration for Real Estate Agent Schema
-- Migration: 20251030120000_real_estate_agent_schema.down.sql

set search_path = public;

-- Drop policies
drop policy if exists "operators_read_listings" on public.listings;
drop policy if exists "operators_read_contacts" on public.contacts;
drop policy if exists "operators_read_lead_requests" on public.lead_requests;
drop policy if exists "operators_read_matches" on public.matches;
drop policy if exists "operators_read_comms" on public.comms;
drop policy if exists "operators_read_consents" on public.consents;
drop policy if exists "operators_read_embeddings" on public.embeddings;
drop policy if exists "public_read_sources" on public.sources;

-- Drop tables (in reverse dependency order)
drop table if exists public.embeddings cascade;
drop table if exists public.consents cascade;
drop table if exists public.comms cascade;
drop table if exists public.matches cascade;
drop table if exists public.lead_requests cascade;
drop table if exists public.owners cascade;
drop table if exists public.contacts cascade;
drop table if exists public.listings cascade;
drop table if exists public.sources cascade;

-- Note: We don't drop the vector extension as it may be used by other features
