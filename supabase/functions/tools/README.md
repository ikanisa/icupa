# Real Estate Agent Tools - Edge Functions

This directory contains Supabase Edge Functions that provide tools for the real estate agent system.

## Functions Overview

### 1. `db-search-listings` (POST)
Searches listings based on filters.

**Endpoint:** `/functions/v1/tools/db-search-listings`

**Request Body:**
```json
{
  "budget_min": 900,
  "budget_max": 1300,
  "locations": ["Sliema", "St Julians"],
  "beds": 2,
  "baths": 1,
  "type": "apartment",
  "longlet": true,
  "furnished": true,
  "pets": false,
  "amenities": ["wifi", "air_conditioning"],
  "available_from": "2025-11-01",
  "limit": 80
}
```

**Response:**
```json
{
  "listing_ids": ["uuid1", "uuid2", ...],
  "count": 42
}
```

### 2. `db-get-listing` (GET)
Retrieves full details for a single listing.

**Endpoint:** `/functions/v1/tools/db-get-listing?id=<uuid>`

**Response:** Full listing record

### 3. `db-save-lead-request` (POST)
Saves a seeker's property request.

**Endpoint:** `/functions/v1/tools/db-save-lead-request`

**Request Body:**
```json
{
  "seeker_contact_id": "uuid",
  "prefs": {
    "beds": 2,
    "furnished": true
  },
  "budget_min": 900,
  "budget_max": 1300,
  "locations": ["Sliema", "Gzira"],
  "long_or_short": "long"
}
```

**Response:**
```json
{
  "lead_request_id": "uuid",
  "created_at": "2025-10-30T12:00:00Z"
}
```

### 4. `db-save-matches` (POST)
Saves matching results between requests and listings.

**Endpoint:** `/functions/v1/tools/db-save-matches`

**Request Body:**
```json
{
  "matches": [
    {
      "lead_request_id": "uuid",
      "listing_id": "uuid",
      "score": 0.95,
      "reasons": ["Price within budget", "Desired location"],
      "status": "pending_owner"
    }
  ]
}
```

**Response:**
```json
{
  "inserted": 1,
  "updated": 0,
  "match_ids": ["uuid"]
}
```

### 5. `db-log-comm` (POST)
Logs a communication event (WhatsApp, SIP, email).

**Endpoint:** `/functions/v1/tools/db-log-comm`

**Request Body:**
```json
{
  "channel": "whatsapp",
  "direction": "outbound",
  "listing_id": "uuid",
  "contact_id": "uuid",
  "thread_id": "thread-12345",
  "transcript": "Agent: Hello...",
  "consent_snapshot": {
    "consent_status": "granted",
    "timestamp": "2025-10-30T12:00:00Z"
  },
  "started_at": "2025-10-30T12:00:00Z",
  "ended_at": "2025-10-30T12:05:00Z"
}
```

**Response:**
```json
{
  "comm_id": "uuid",
  "created_at": "2025-10-30T12:00:00Z"
}
```

### 6. `embed-listings` (POST)
Generates vector embeddings for listings.

**Endpoint:** `/functions/v1/tools/embed-listings`

**Request Body:**
```json
{
  "listing_ids": ["uuid1", "uuid2"],
  "force": false,
  "limit": 32
}
```

**Response:**
```json
{
  "updated": 32
}
```

## Authentication

All tools require authentication via one of:
- `Authorization: Bearer <token>` header
- `x-api-key: <key>` header

Set `RE_TOOLS_API_KEY` environment variable to configure the expected key.

## Deployment

Deploy all tools functions:

```bash
supabase functions deploy tools
```

Or deploy individually:

```bash
supabase functions deploy tools/db-search-listings
supabase functions deploy tools/db-get-listing
# etc...
```

## Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for bypassing RLS
- `OPENAI_API_KEY` - OpenAI API key (for embeddings)

Optional:
- `RE_TOOLS_API_KEY` - API key for authenticating tool requests
- `OPENAI_EMBEDDING_MODEL` - Embedding model (default: `text-embedding-3-small`)

## Testing

Test with curl:

```bash
# Search listings
curl -X POST https://your-project.supabase.co/functions/v1/tools/db-search-listings \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"budget_min": 900, "budget_max": 1300, "locations": ["Sliema"]}'

# Get listing
curl https://your-project.supabase.co/functions/v1/tools/db-get-listing?id=UUID \
  -H "Authorization: Bearer YOUR_KEY"
```
