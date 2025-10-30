# Real Estate Agent Infrastructure - Phase 0

## Baseline Schema Export

To export the current baseline schema before adding real estate agent tables:

```bash
# Start local Supabase (requires Docker)
npx supabase start

# Export schema (structure only, no data)
npx supabase db dump --local --data-only=false --file ./supabase/seed/baseline.sql

# OR export with data for reference
npx supabase db dump --local --file ./supabase/seed/baseline-with-data.sql
```

## Feature Flag

The real estate agent feature is controlled by the `FEATURE_REAL_ESTATE_AGENT` environment variable.

- Set to `true` in production when ready to enable
- Set to `false` (default) to disable

Add to your `.env.local`:
```
FEATURE_REAL_ESTATE_AGENT=true
```

## Required Secrets

See `.env.local.example` for a complete list of required environment variables including:

### Communication Channels
- WhatsApp Cloud API credentials (`WA_*`)
- SIP/Telephony provider credentials (`SIP_*`, `TWILIO_*`)

### External Services
- Cloudflare Workers (`CF_ACCOUNT_ID`, `CF_API_TOKEN`)
- Geocoding service (`GEOCODER_KEY`)
- OpenAI Realtime API (`OPENAI_REALTIME_*`)

### Core Services
- Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- OpenAI (`OPENAI_API_KEY`)

## Acceptance Test

After setting up:

1. Start local Supabase:
   ```bash
   pnpm supabase:start
   ```

2. Verify app still boots unchanged:
   ```bash
   pnpm dev
   ```

3. App should start on http://localhost:8080 (or configured port) without errors
