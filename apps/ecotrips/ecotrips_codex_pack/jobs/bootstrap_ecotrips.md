# Codex Job: Bootstrap ecoTrips Monorepo (Supabase + Edge Functions + Migrations)

> Run me from your terminal at the repo root after extracting this pack:
>
> ```bash
> # 0) Create repo folder and enter it
> mkdir ecotrips && cd ecotrips
> git init
>
> # 1) Copy this job file here (if not already) and run with Codex CLI
> # (Assumes you have codex CLI installed. If not, install per your environment.)
> codex run ecotrips_codex_pack/jobs/bootstrap_ecotrips.md
> ```
>
> Requires: git, node>=20, deno, docker (for local supabase), supabase CLI, codex CLI.

---

## Variables (edit if needed)

- PROJECT_REF: `woyknezboamabahknmjr`
- SUPABASE_URL: `https://woyknezboamabahknmjr.supabase.co`

> ⚠️ **Security note**: Never commit your Service Role secret. Keep secrets in `.env` or your CI secret store.

---

## Steps

### 1) Initialize workspace and base files

```bash
# Ensure tools
deno --version
node -v
supabase --version
git --version

# Workspace (idempotent)
mkdir -p apps/web packages/ui services/bff services/bookings services/payments services/inventory services/groups ops/console db/migrations ecotrips_codex_pack/jobs

# Base files
cat > README.md << 'EOF'
# ecoTrips — Monorepo
PWA + Supabase + Edge Functions baseline.
See ecotrips_codex_pack/README-FIRST.md for setup.
EOF

cat > .gitignore << 'EOF'
node_modules
.env
.supabase
.DS_Store
dist
coverage
EOF

cat > .env.example << 'EOF'
# === Supabase ===
SUPABASE_URL=https://woyknezboamabahknmjr.supabase.co
SUPABASE_ANON_KEY=<paste_anon_key_here>
# NEVER commit or share your service role key
SUPABASE_SERVICE_ROLE=<paste_service_role_here_for_local_only>

# === Stripe (sandbox) ===
STRIPE_SECRET_KEY=<sk_test_xxx>
STRIPE_WEBHOOK_SECRET=<whsec_xxx>

# === OpenAI ===
OPENAI_API_KEY=<sk-or-gp_xxx>
EOF

# project-level package.json (workspace managed)
cat > package.json << 'EOF'
{
  "name": "ecotrips",
  "private": true,
  "workspaces": ["apps/*", "packages/*", "services/*", "ops/*"],
  "scripts": {
    "dev": "echo 'Add Next.js app later'",
    "db:migrate": "supabase migration up",
    "db:new": "supabase migration new",
    "format": "deno fmt supabase/functions/**/index.ts",
    "typecheck": "echo 'Add TS checks once FE/BE packages exist'"
  }
}
EOF
```

### 2) Supabase init & link

```bash
# Initialize supabase locally (if not already)
if [ ! -f supabase/config.toml ]; then
  supabase init
fi

# Link to your cloud project (replace with your logged-in account context)
supabase link --project-ref woyknezboamabahknmjr
```

### 3) Database schemas & migrations

```bash
# Create initial migration if not exists
if [ ! -d "supabase/migrations" ]; then
  mkdir -p supabase/migrations
fi

cat > supabase/migrations/0001_init.sql << 'EOF'
-- ecoTrips DB init (minimal v1) — safe, additive
create schema if not exists core;
create schema if not exists catalog;
create schema if not exists booking;
create schema if not exists payment;
create schema if not exists "group";
create schema if not exists audit;

-- Users & profiles (using Supabase auth for users)
create table if not exists core.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  persona text check (persona in ('consumer','supplier','ops')) default 'consumer',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Groups (social travel)
create table if not exists "group".groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null,
  name text,
  size_target int check (size_target > 0),
  discount_tiers jsonb default '[]'::jsonb,
  status text check (status in ('draft','open','locked','cancelled','completed')) default 'open',
  created_at timestamptz default now()
);

-- Itineraries & items
create table if not exists booking.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  group_id uuid,
  currency text default 'USD',
  total_cents bigint default 0,
  status text check (status in ('draft','quoted','booked','cancelled')) default 'draft',
  created_at timestamptz default now()
);

create table if not exists booking.items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references booking.itineraries(id) on delete cascade,
  item_type text check (item_type in ('hotel','tour','transfer','permit','other')),
  supplier_ref text,
  start_at timestamptz,
  end_at timestamptz,
  pax jsonb default '[]'::jsonb,
  price_cents bigint default 0,
  currency text default 'USD'
);

-- Payments (intents) — idempotent
create table if not exists payment.payments (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references booking.itineraries(id) on delete set null,
  intent_id text unique,
  amount_cents bigint not null,
  currency text default 'USD',
  provider text default 'stripe',
  status text check (status in ('requires_action','processing','succeeded','failed','refunded','voided')) default 'processing',
  idempotency_key text,
  created_at timestamptz default now()
);

-- Auditing (tamper-evident seed; full WORM storage via external later)
create table if not exists audit.events (
  id bigserial primary key,
  who uuid,
  what text not null,
  payload jsonb,
  created_at timestamptz default now()
);
EOF

# Apply migration locally
supabase migration up
```

### 4) Edge Functions (BFF & Webhooks)

```bash
mkdir -p supabase/functions/bff-quote supabase/functions/bff-checkout supabase/functions/stripe-webhook supabase/functions/supplier-webhook

# shared import map and deno.json per function
for fn in bff-quote bff-checkout stripe-webhook supplier-webhook; do
cat > supabase/functions/$fn/deno.json << 'EOF'
{
  "tasks": {
    "start": "deno run -A --watch=static/,routes/ index.ts"
  },
  "compilerOptions": {
    "strict": true
  }
}
EOF

cat > supabase/functions/$fn/import_map.json << 'EOF'
{
  "imports": {
    "serve": "https://deno.land/std@0.224.0/http/server.ts"
  }
}
EOF
done

# bff-quote
cat > supabase/functions/bff-quote/index.ts << 'EOF'
import { serve } from "serve";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    }
    const body = await req.json().catch(() => ({}));
    // TODO: validate input, query suppliers, compute quote
    const quote = { total_cents: 123450, currency: "USD", items: [] };
    return new Response(JSON.stringify({ ok: true, quote }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
EOF

# bff-checkout
cat > supabase/functions/bff-checkout/index.ts << 'EOF'
import { serve } from "serve";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
    }
    const body = await req.json().catch(() => ({}));
    // TODO: create PaymentIntent (Stripe) with idempotency key, persist to payment.payments
    return new Response(JSON.stringify({ ok: true, payment_intent: "pi_mock_123" }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
EOF

# stripe-webhook
cat > supabase/functions/stripe-webhook/index.ts << 'EOF'
import { serve } from "serve";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("ok", { status: 200 });
    }
    // TODO: verify signature and update payment/payments + booking state
    return new Response("ok", { status: 200 });
  } catch (_e) {
    return new Response("err", { status: 500 });
  }
});
EOF

# supplier-webhook
cat > supabase/functions/supplier-webhook/index.ts << 'EOF'
import { serve } from "serve";

serve(async (_req) => {
  // TODO: upsert supplier confirmations, map supplier_ref->booking items
  return new Response(JSON.stringify({ ok: true }),
    { headers: { "content-type": "application/json" } });
});
EOF
```

### 5) Deploy functions (cloud)

```bash
# Make sure you're logged in: supabase login
# Then deploy:
supabase functions deploy bff-quote bff-checkout stripe-webhook supplier-webhook --project-ref woyknezboamabahknmjr
```

### 6) Quick test (local)

```bash
# Start local supabase if needed
supabase start

# Serve one function locally (example)
cd supabase/functions/bff-quote && deno task start
# In another terminal:
curl -X POST http://localhost:54321/functions/v1/bff-quote -H "Content-Type: application/json" -d '{"items": []}'
```

---

## Next recommended Codex jobs
- `jobs/add_groups_split_pay.md` — creates groups tables, policies, and endpoints.
- `jobs/add_ops_console.md` — scaffolds Next.js admin app for ops.
- `jobs/integrate_stripe_intents.md` — end-to-end Stripe intents flow with idempotency.
