# Real Estate Agent Infrastructure

This directory contains the complete infrastructure for the real estate agent system, including database schema, Edge Functions, and documentation.

## 📋 Overview

The real estate agent infrastructure enables automated property matching between seekers and listings using:
- **Database layer** (Supabase/PostgreSQL with pgvector)
- **Edge Functions** (Supabase Deno functions)
- **Hybrid matching** (SQL filters + vector search + LLM re-ranking)
- **Communication channels** (WhatsApp, SIP, email)
- **GDPR compliance** (consent tracking)

## 🚀 Quick Start

1. **Setup environment:**
   ```bash
   cp .env.local.example .env.local
   # Fill in required values
   ```

2. **Start local Supabase:**
   ```bash
   pnpm supabase:start
   ```

3. **Apply migrations:**
   ```bash
   pnpm supabase:reset
   ```

4. **Deploy Edge Functions:**
   ```bash
   npx supabase functions deploy tools
   ```

5. **Generate embeddings:**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/tools/embed-listings \
     -H "Authorization: Bearer YOUR_KEY" \
     -d '{"limit": 10}'
   ```

## 📁 Structure

```
docs/real-estate-agent/
├── phase-0-prep.md              # Environment setup & feature flags
├── phase-3-matching-engine.md   # Matching algorithm documentation
└── deployment-guide.md          # Complete deployment instructions

supabase/
├── migrations/
│   ├── 20251030120000_real_estate_agent_schema.sql       # Main schema
│   └── 20251030120000_real_estate_agent_schema.down.sql  # Rollback
├── seed/
│   └── real-estate-agent.sql    # Sample test data
└── functions/
    └── tools/
        ├── index.ts             # Function router
        ├── README.md            # API documentation
        ├── _shared/
        │   └── auth.ts          # Authentication helpers
        ├── db-search-listings/  # Search with filters
        ├── db-get-listing/      # Get single listing
        ├── db-save-lead-request/# Save seeker request
        ├── db-save-matches/     # Save match results
        ├── db-log-comm/         # Log communications
        └── embed-listings/      # Generate embeddings
```

## 📊 Database Schema

### Core Tables

- **`sources`** - Data source provenance (websites, APIs)
- **`listings`** - Canonical property listings
- **`contacts`** - People and agencies
- **`owners`** - Property owners with verification
- **`lead_requests`** - Seeker search requests
- **`matches`** - Match results with scores
- **`comms`** - Communication log (WhatsApp, SIP, email)
- **`consents`** - GDPR consent records
- **`embeddings`** - Vector embeddings for semantic search

### Indices

- Price range queries
- Geographic queries (lat/lng)
- Full-text search on title/description
- Vector similarity (IVFFlat)

### Row Level Security (RLS)

All tables have RLS enabled with conservative policies. Service role bypasses RLS.

## 🔧 Edge Functions (Tools)

All tools are accessible at `/functions/v1/tools/<tool-name>`

### Available Tools

| Tool | Method | Description |
|------|--------|-------------|
| `db-search-listings` | POST | Search listings with filters |
| `db-get-listing` | GET | Get listing details by ID |
| `db-save-lead-request` | POST | Save seeker request |
| `db-save-matches` | POST | Save match results |
| `db-log-comm` | POST | Log communication event |
| `embed-listings` | POST | Generate embeddings |

See [supabase/functions/tools/README.md](../../supabase/functions/tools/README.md) for detailed API documentation.

## 🎯 Matching Algorithm

Three-stage hybrid approach:

1. **SQL Hard Filters** → ~80 candidates
   - Price range, location, beds/baths, amenities
   
2. **Vector Similarity** → ~30 candidates (optional)
   - Semantic search via pgvector
   - Only when text preferences provided
   
3. **LLM Re-ranking** → Top matches with scores
   - OpenAI Structured Outputs
   - Score (0.0-1.0) + reasons for each

See [phase-3-matching-engine.md](phase-3-matching-engine.md) for details.

## 🔐 Security & Compliance

### Authentication

- API key via `Authorization: Bearer <token>` or `x-api-key` header
- Service role key for Edge Functions
- Configurable via `RE_TOOLS_API_KEY` environment variable

### GDPR Compliance

- Explicit consent tracking in `consents` table
- Consent snapshots in `comms` table
- Right to erasure via cascade deletes

### Data Provenance

- Source tracking for scraped data
- Terms of Service and robots.txt compliance
- Rate limiting and crawl policies

## 🧪 Testing

### Unit Tests

```bash
pnpm test
```

### Acceptance Tests

1. **Database migration:**
   ```bash
   pnpm supabase:reset
   # Should apply cleanly
   ```

2. **Sample queries:**
   ```sql
   select * from listings where price_eur between 900 and 1300;
   ```

3. **Edge Functions:**
   ```bash
   curl http://localhost:54321/functions/v1/tools/db-search-listings \
     -H "Authorization: Bearer KEY" \
     -d '{"budget_min": 900, "budget_max": 1300}'
   ```

### Load Testing

```bash
# k6 tests (future)
k6 run tests/k6/real-estate-agent.js
```

## 📖 Documentation

- [Phase 0: Prep & Guardrails](phase-0-prep.md)
- [Phase 3: Matching Engine](phase-3-matching-engine.md)
- [Deployment Guide](deployment-guide.md)
- [Edge Functions API](../../supabase/functions/tools/README.md)

## 🚧 Roadmap

### Phase 2b: Cloudflare Workers (Future)

- WhatsApp webhook handler
- Web scraping worker with Browser Rendering
- SIP bridge for voice calls
- Cron jobs for scheduled ingestion

### Phase 3b: Advanced Matching (Future)

- LLM re-ranking implementation
- User feedback loop
- Collaborative filtering
- Geographic scoring
- Dynamic pricing alerts

### Phase 4: Agent Integration (Future)

- OpenAI Assistants API integration
- Multi-turn conversations
- Appointment scheduling
- Tour booking

## 🔑 Environment Variables

### Required

```bash
# Core services
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...

# Feature flag
FEATURE_REAL_ESTATE_AGENT=true

# Tool authentication
RE_TOOLS_API_KEY=generate-secure-key
```

### Optional

```bash
# Communication channels
WA_ACCESS_TOKEN=...
WA_VERIFY_TOKEN=...
SIP_TRUNK_URI=...
TWILIO_ACCOUNT_SID=...

# Cloudflare
CF_ACCOUNT_ID=...
CF_API_TOKEN=...

# Geocoding
GEOCODER_KEY=...
GEOCODER_PROVIDER=opencage

# Embedding model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

See [.env.local.example](../../.env.local.example) for complete reference.

## 📞 Support

For issues or questions:
- Check [deployment-guide.md](deployment-guide.md) troubleshooting section
- Review Edge Function logs: `npx supabase functions logs tools`
- Check database queries in Supabase Studio

## 📝 License

Same as parent project.
