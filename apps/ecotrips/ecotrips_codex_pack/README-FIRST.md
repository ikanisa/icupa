# ecoTrips — Codex + Supabase Starter Pack (READ ME FIRST)

This pack gives you:
- A **Codex job** to scaffold your monorepo quickly
- A **minimal Supabase migration** (schemas & essential tables)
- **Four Edge Function stubs** (BFF + webhooks) that deploy cleanly

## How to use

1) Extract this folder anywhere.
2) In a terminal:
   ```bash
   mkdir ecotrips && cd ecotrips
   git init
   # Copy this pack into the repo (or reference it by path)
   # Then run:
   codex run ecotrips_codex_pack/jobs/bootstrap_ecotrips.md
   ```
3) After generation, run local stack:
   ```bash
   supabase start
   ```
4) Deploy Edge Functions to your project:
   ```bash
   supabase functions deploy bff-quote bff-checkout stripe-webhook supplier-webhook --project-ref woyknezboamabahknmjr
   ```

### Security
- Put your **Anon** key in `.env` for local client calls.
- **Never** commit the **Service Role** key. Use it only in secure server contexts or CI secret stores.
