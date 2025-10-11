-- Update the pg_cron target URL for the embeddings refresh job
-- Usage:
--   1) Replace <project-ref> with your Supabase project ref
--   2) Paste into the Supabase SQL Editor and run

update public.scheduler_config
set value = 'https://<project-ref>.functions.supabase.co/menu/embed_items'
where key = 'menu_embed_items_url';

