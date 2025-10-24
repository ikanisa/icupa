# Atlas + Supabase (Step 1)
- Ensure `.env.local` has:
  - NEXT_PUBLIC_APP_NAME
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
- `npm i`
- `npm run dev`
- Visit `/atlas-check` to verify Atlas UI + Supabase env.
- Note: Do not expose the Supabase service role key in client code. We will add a server API route for writes in Step 2.
