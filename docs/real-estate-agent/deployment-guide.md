# Real Estate Agent Infrastructure - Deployment Guide

## Prerequisites

- Docker (for local Supabase)
- Node.js 18+ and pnpm
- Supabase CLI (`npx supabase`)
- Access to Supabase project
- OpenAI API key
- Cloudflare account (for Workers - Phase 2b)

## Phase 0: Setup

### 1. Environment Variables

Create `.env.local` from `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Fill in required values:
```bash
# Core services
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...

# Real estate agent
FEATURE_REAL_ESTATE_AGENT=true
RE_TOOLS_API_KEY=generate-a-secure-key-here

# Communication channels (optional for now)
WA_ACCESS_TOKEN=...
SIP_TRUNK_URI=...
```

### 2. Local Development

Start local Supabase:
```bash
pnpm supabase:start
```

This will:
- Start PostgreSQL with pgvector extension
- Start Kong API gateway
- Start Studio UI (http://localhost:54323)
- Output connection details

Save the output, especially:
- `API URL`: http://localhost:54321
- `anon key`: eyJ...
- `service_role key`: eyJ...

## Phase 1: Database Migration

### Apply Migration

```bash
# Reset database and apply all migrations
pnpm supabase:reset

# Or apply migrations incrementally
npx supabase migration up
```

Verify tables were created:
```bash
npx supabase db dump --schema public --data-only=false
```

### Seed Data

Apply seed data for testing:
```bash
npx supabase db seed
```

This loads:
- Demo tenants and locations (from seed.sql)
- Sample listings, contacts, and matches (from real-estate-agent.sql)

### Verify Schema

Open Supabase Studio: http://localhost:54323

Navigate to:
1. **Table Editor** - Verify tables exist
2. **SQL Editor** - Run test queries:

```sql
-- Check tables
select count(*) from listings;
select count(*) from contacts;
select count(*) from lead_requests;

-- Test search
select id, title, price_eur, location_text 
from listings 
where price_eur between 900 and 1300
  and location_text ilike '%Sliema%'
limit 5;
```

## Phase 2: Edge Functions

### Deploy Functions

Deploy all tools functions:
```bash
# Link to your project (one-time)
npx supabase link --project-ref your-project-ref

# Deploy all functions
npx supabase functions deploy tools
```

Or deploy individually:
```bash
npx supabase functions deploy tools/db-search-listings
npx supabase functions deploy tools/db-get-listing
npx supabase functions deploy tools/db-save-lead-request
npx supabase functions deploy tools/db-save-matches
npx supabase functions deploy tools/db-log-comm
npx supabase functions deploy tools/embed-listings
```

### Set Secrets

Configure environment variables for Edge Functions:
```bash
npx supabase secrets set \
  OPENAI_API_KEY=sk-... \
  RE_TOOLS_API_KEY=your-secure-key \
  OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Test Functions

Test locally:
```bash
# Start functions locally
npx supabase functions serve tools --env-file .env.local
```

In another terminal:
```bash
# Test search
curl -X POST http://localhost:54321/functions/v1/tools/db-search-listings \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"budget_min": 900, "budget_max": 1300, "locations": ["Sliema"]}'

# Test get listing
curl http://localhost:54321/functions/v1/tools/db-get-listing?id=30000000-0000-4000-8000-000000000001 \
  -H "Authorization: Bearer YOUR_KEY"

# Test embeddings
curl -X POST http://localhost:54321/functions/v1/tools/embed-listings \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

## Phase 3: Generate Embeddings

### Initial Embedding Run

Generate embeddings for existing listings:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/tools/embed-listings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

### Scheduled Updates

Add to crontab or use Supabase cron:
```sql
-- Add to migration or run manually
select cron.schedule(
  'embed-new-listings',
  '0 */6 * * *', -- Every 6 hours
  $$
  select net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/tools/embed-listings',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{"limit": 50}'::jsonb
  );
  $$
);
```

## Acceptance Testing

### Test 1: App Boots Unchanged

```bash
# Start the app
pnpm dev

# Verify it starts without errors
# Visit http://localhost:8080
```

Expected: App loads normally, real estate features are disabled (FEATURE_REAL_ESTATE_AGENT=false)

### Test 2: Database Schema

```bash
npx supabase db reset --local
```

Expected:
- ✅ All migrations apply cleanly
- ✅ Tables created: sources, listings, contacts, owners, lead_requests, matches, comms, consents, embeddings
- ✅ Indices created
- ✅ RLS enabled
- ✅ Seed data loads

### Test 3: Query Sample Data

```sql
-- Insert a test listing
insert into public.listings (
  title, 
  description, 
  type, 
  location_text, 
  price_eur, 
  beds, 
  baths
) values (
  'Test Apartment',
  'Modern 2BR in Sliema',
  'apartment',
  'Sliema, Malta',
  1200,
  2,
  1
);

-- Insert a test lead request
insert into public.lead_requests (
  budget_min,
  budget_max,
  locations,
  long_or_short
) values (
  900,
  1300,
  ARRAY['Sliema', 'St Julians'],
  'long'
);

-- Query should return the listing
select * from listings 
where price_eur between 900 and 1300
  and location_text ilike '%Sliema%';
```

### Test 4: Tool Functions

Run all curl commands from Phase 2 above.

Expected:
- ✅ All functions return 200 OK
- ✅ Search returns listing IDs
- ✅ Get listing returns full record
- ✅ Save operations return new IDs
- ✅ Embed function updates embedding count

## Production Deployment

### 1. Database

```bash
# From your project root
npx supabase db push
```

### 2. Edge Functions

```bash
npx supabase functions deploy tools
```

### 3. Secrets

```bash
npx supabase secrets set \
  OPENAI_API_KEY=sk-... \
  RE_TOOLS_API_KEY=production-key \
  OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 4. Enable Feature Flag

Update production environment:
```bash
FEATURE_REAL_ESTATE_AGENT=true
```

### 5. Generate Production Embeddings

```bash
curl -X POST https://your-project.supabase.co/functions/v1/tools/embed-listings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 1000}'
```

## Monitoring

### Check Function Logs

```bash
npx supabase functions logs tools
```

### Check Database Stats

```sql
-- Listing counts
select count(*) as total_listings from listings;
select count(*) as embedded_listings from embeddings;

-- Match statistics
select 
  status,
  count(*) as count
from matches
group by status
order by count desc;

-- Recent communications
select 
  channel,
  direction,
  count(*) as count
from comms
where started_at > now() - interval '7 days'
group by channel, direction;
```

## Troubleshooting

### Issue: Migrations fail

**Solution:** Check migration order and dependencies
```bash
npx supabase migration list
npx supabase db reset --local
```

### Issue: Functions return 401

**Solution:** Check API key configuration
```bash
# View secrets
npx supabase secrets list

# Update secret
npx supabase secrets set RE_TOOLS_API_KEY=new-key
```

### Issue: Embeddings fail

**Solution:** Check OpenAI API key and quota
```bash
# Test OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Issue: Vector search slow

**Solution:** Rebuild ivfflat index with more lists
```sql
-- Drop and recreate index
drop index idx_embeddings_vector;
create index idx_embeddings_vector 
  on embeddings 
  using ivfflat (vector vector_cosine_ops)
  with (lists = 200); -- Increase from 100
```

## Next Steps

1. **Phase 2b: Cloudflare Workers** (future)
   - WhatsApp webhook handler
   - Web scraping worker
   - SIP bridge

2. **Phase 3b: LLM Re-ranking** (future)
   - Implement OpenAI Structured Outputs for ranking
   - Add scoring logic to db-search-listings

3. **Integration Testing**
   - E2E tests for full matching workflow
   - Load testing with k6

4. **Production Monitoring**
   - Set up alerts for function errors
   - Monitor embedding coverage
   - Track match success rates
