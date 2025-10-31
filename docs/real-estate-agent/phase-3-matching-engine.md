# Real Estate Agent - Phase 3: Matching Engine

## Overview

The matching engine uses a hybrid approach to match seekers with listings:
1. **SQL hard filters** - Narrow down candidates based on requirements
2. **Vector similarity search** - Semantic matching for text preferences
3. **LLM re-ranking** - Final scoring with explanations

## Architecture

```
Seeker Request
    ↓
┌─────────────────────────────────────┐
│  1. SQL Hard Filters                │
│  - Price range                      │
│  - Location                         │
│  - Beds/baths                       │
│  - Availability date                │
│  - Property type                    │
│  → Result: ~80 candidates           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  2. Vector Similarity (Optional)    │
│  - Only if prefs.text present       │
│  - Semantic search via pgvector     │
│  - Cosine similarity                │
│  → Result: Top ~30 candidates       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  3. LLM Re-ranking                  │
│  - OpenAI Structured Outputs        │
│  - Score + reasons for each         │
│  - Deterministic JSON schema        │
│  → Result: Top matches with scores  │
└─────────────────────────────────────┘
    ↓
Store in matches table
```

## Implementation

### Step 1: SQL Hard Filters

Already implemented in `db-search-listings` function. Filters by:
- Budget range
- Location (case-insensitive partial match)
- Number of bedrooms/bathrooms (minimum)
- Property type
- Furnished status
- Pet policy
- Rental duration (long/short let)
- Amenities (contains any)
- Available from date

Returns up to 80 listing IDs by default (configurable via `limit` parameter).

### Step 2: Vector Similarity Search

When `prefs.text` is provided (natural language description), use pgvector:

```typescript
// Example: Add to db-search-listings
if (filters.prefs?.text) {
  // Generate embedding for search query
  const queryEmbedding = await createEmbedding(filters.prefs.text);
  
  // Query embeddings table with vector similarity
  const { data } = await supabase.rpc('match_listings', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 30,
    listing_ids: candidateIds // from Step 1
  });
}
```

SQL function to add to migration:

```sql
create or replace function match_listings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  listing_ids uuid[]
)
returns table (
  listing_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select 
    e.listing_id,
    1 - (e.vector <=> query_embedding) as similarity
  from embeddings e
  where 
    e.listing_id = any(listing_ids)
    and 1 - (e.vector <=> query_embedding) > match_threshold
  order by e.vector <=> query_embedding
  limit match_count;
end;
$$;
```

### Step 3: LLM Re-ranking

Use OpenAI's Structured Outputs to generate deterministic rankings:

```typescript
interface RankingInput {
  seeker_prefs: {
    budget_min?: number;
    budget_max?: number;
    locations?: string[];
    beds?: number;
    description?: string;
  };
  listings: Array<{
    id: string;
    title: string;
    description: string;
    price_eur: number;
    location_text: string;
    beds: number;
    amenities: string[];
  }>;
}

interface RankingOutput {
  matches: Array<{
    listing_id: string;
    score: number; // 0.0 to 1.0
    reasons: string[];
  }>;
}

const response = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview",
  messages: [
    {
      role: "system",
      content: "You are a real estate matching expert. Rank listings by how well they match the seeker's preferences. Provide a score from 0.0 to 1.0 and specific reasons for each match."
    },
    {
      role: "user",
      content: JSON.stringify(rankingInput)
    }
  ],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "listing_ranking",
      schema: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                listing_id: { type: "string" },
                score: { type: "number", minimum: 0, maximum: 1 },
                reasons: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["listing_id", "score", "reasons"]
            }
          }
        },
        required: ["matches"]
      }
    }
  }
});
```

## Data Contracts

### Immutable IDs
- `listing_id` (UUID) - Stable identifier for listings
- `contact_id` (UUID) - Stable identifier for contacts
- `lead_request_id` (UUID) - Stable identifier for seeker requests
- `match_id` (UUID) - Stable identifier for match records

### Merge Rules

**Deduplication:**
- Listings: Unique on `(source_id, external_id)`
- If duplicate found, update existing record instead of inserting

**Fuzzy Matching:**
- Title similarity (Levenshtein distance < 5)
- Address normalization (remove spaces, lowercase, punctuation)
- Geocoding tolerance (±0.001 degrees = ~100m)

**Merge Strategy:**
```typescript
async function mergeListings(newListing, existingListings) {
  // Find best match by similarity score
  const match = existingListings.find(existing => 
    similarity(newListing.title, existing.title) > 0.9 &&
    geoDistance(newListing, existing) < 100 // meters
  );
  
  if (match) {
    // Update existing record
    return {
      ...match,
      updated_at: new Date(),
      // Merge photos, amenities
      photos: [...new Set([...match.photos, ...newListing.photos])],
      amenities: [...new Set([...match.amenities, ...newListing.amenities])]
    };
  } else {
    // Insert new record
    return newListing;
  }
}
```

## Testing

### Acceptance Criteria

Given a sample seeker profile:
```json
{
  "budget_min": 900,
  "budget_max": 1300,
  "locations": ["Sliema"],
  "beds": 2,
  "prefs": {
    "furnished": true,
    "text": "Looking for a modern apartment with sea view, close to restaurants"
  }
}
```

The matching engine should:
1. ✅ Return only listings within budget (€900-€1300)
2. ✅ Return only listings in or near Sliema
3. ✅ Return only listings with 2+ bedrooms
4. ✅ Prioritize furnished apartments
5. ✅ Score higher for listings mentioning "sea view"
6. ✅ Provide clear reasons for each match
7. ✅ Be deterministic (same input = same output)

### Test Cases

1. **SQL Filters Only**
   - Input: Basic filters (price, location, beds)
   - Expected: 3-10 candidates
   - Verify: All meet hard constraints

2. **With Vector Search**
   - Input: + "sea view, modern, quiet"
   - Expected: Top 5 include sea view properties
   - Verify: Semantic matches rank higher

3. **Full Pipeline**
   - Input: Complete profile with text preferences
   - Expected: Top 3 results with scores > 0.8
   - Verify: Reasons are accurate and specific

## Future Enhancements

1. **User Feedback Loop**
   - Track which matches lead to viewings
   - Adjust scoring weights based on success rate

2. **Time-based Scoring**
   - Penalize older listings
   - Boost newly available properties

3. **Collaborative Filtering**
   - "Users who liked X also liked Y"
   - Build preference profiles over time

4. **Geographic Scoring**
   - Distance-based decay from preferred locations
   - Transit accessibility scores

5. **Dynamic Pricing**
   - Alert when price drops
   - Suggest counter-offers based on market data
