set search_path = public, extensions;

drop table if exists public.agent_events cascade;
drop table if exists public.orders cascade;
drop table if exists public.items cascade;
drop table if exists public.locations cascade;
drop table if exists public.tenants cascade;

drop extension if exists "pgcrypto";
drop extension if exists "uuid-ossp";
