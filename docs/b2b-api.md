# B2B API quickstart

The B2B partner APIs rely on scoped API keys stored in `b2b.api_keys`. Keys are issued with hashed storage and masked prefixes. All requests require a `Bearer` token that matches an active key and will increment usage telemetry.

## Inventory index (GET)

```bash
curl "https://woyknezboamabahknmjr.supabase.co/functions/v1/b2b-inventory?page=1&page_size=2&query=gorilla" \
  -H "Authorization: Bearer eco_live_***************" \
  -H "X-Client-Id: partner-sandbox"
```

Example response (redacted):

```json
{
  "ok": true,
  "page": 1,
  "page_size": 2,
  "total": 4,
  "has_next_page": true,
  "items": [
    {
      "id": "eco-lodge-001",
      "name": "Volcano Trails Eco Lodge",
      "headline": "Solar-powered pods with private gorilla trek permits",
      "location": {
        "city": "Musanze",
        "country": "Rwanda",
        "region": "Volcanoes National Park"
      },
      "tags": ["gorilla", "solar", "all-inclusive"],
      "from_price_cents": 118000,
      "currency": "USD"
    },
    {
      "id": "savanna-mobile-207",
      "name": "Akagera Mobile Safari Camp",
      "headline": "Low-impact mobile camp with conservation rangers",
      "location": {
        "city": "Akagera",
        "country": "Rwanda",
        "region": "Akagera National Park"
      },
      "tags": ["big five", "mobile", "conservation"],
      "from_price_cents": 134500,
      "currency": "USD"
    }
  ]
}
```

## Lead intent ingestion (POST)

```bash
curl "https://woyknezboamabahknmjr.supabase.co/functions/v1/b2b-lead-intent" \
  -H "Authorization: Bearer eco_live_***************" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner-req-001" \
  -d '{
    "company_name": "Atlas Conferences",
    "contact_name": "Lea Partner",
    "email": "lea@example.com",
    "phone": "+1-202-555-0102",
    "party_size": 48,
    "start_date": "2025-02-10",
    "end_date": "2025-02-18",
    "destinations": ["Kigali", "Akagera"],
    "budget_min_cents": 2250000,
    "budget_max_cents": 3150000,
    "notes": "Focus on conservation partners and daylight transfers only."
  }'
```

Example response (redacted):

```json
{
  "ok": true,
  "idempotency_reused": false,
  "intent": {
    "id": "intent-********",
    "company_name": "Atlas Conferences",
    "email": "lea@example.com",
    "destinations": ["Kigali", "Akagera"],
    "status": "new",
    "created_at": "2024-05-04T12:00:00Z"
  }
}
```

Subsequent requests with the same `Idempotency-Key` receive the cached `intent` payload.

## Scopes

| Scope          | Purpose                               | Required header |
| -------------- | ------------------------------------- | --------------- |
| `inventory.read` | Access the read-only search index.     | `Authorization: Bearer …` |
| `leads.write`    | Submit partner intent payloads.        | `Authorization: Bearer …`, `Idempotency-Key` |

PlannerCoPilot tooling now advertises these scopes so orchestration policies understand when partner automation is available.
