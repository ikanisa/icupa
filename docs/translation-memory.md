# Translation memory lookup flows

The `translate` edge function keeps ecoTrips copy consistent by consulting the
`comms.tm` table before falling back to a lightweight fixture-backed model.
This document explains the control flow, shows how row level security (RLS)
protects language directions, and demonstrates hit counter updates while using
fixtures.

## Flow summary

1. **Validate request** – the function requires `source_lang`, `target_lang`,
   and `text` with ISO language codes. Identical language pairs return an input
   error.
2. **Audit lookup** – `withObs` instrumentation stamps every request with an
   audit log containing the direction (`en>fr`, `fr>en`, etc.) so ops teams can
   trace behaviour.
3. **Translation memory check** – the handler performs a REST query against
   `comms.tm`. When the row exists the helper RPC
   `comms_upsert_tm_entry` increments the relevant hit counter inside a
   transaction-safe upsert and returns the fresh values. If the source text is
   found as the *target* of the opposite direction (`fr>en` request with an
   `en>fr` row, for example) the reverse counter increments and the stored
   source text becomes the translated output.
4. **Model fallback** – if the memory miss occurs, the fixture model provides a
   deterministic translation (fixture, reverse lookup, or a `[lang] text`
   synthetic). The result is written back through the same RPC to seed the TM
   for subsequent lookups.
5. **Response payload** – clients receive the translation, hit counters, the
   request id, and whether the result persisted (false when running with
   fixtures).

## RLS per language direction

The migration `0041_tm.sql` introduces the `comms.tm` table along with the
`comms.allowed_direction` helper. Policies use this helper so only JWTs that
include a matching `tm_directions` claim (for example `"en>fr"`) can read or
mutate rows. Service-role callers bypass the policy as expected.

```sql
create policy tm_select_direction on comms.tm
  for select using (comms.allowed_direction(source_lang, target_lang));
create policy tm_modify_direction on comms.tm
  for all using (comms.allowed_direction(source_lang, target_lang))
  with check (comms.allowed_direction(source_lang, target_lang));
```

## Fixture walkthrough

1. Start the local Supabase stack and expose the function, enabling fixtures:

   ```bash
   USE_FIXTURES=1 supabase functions serve translate --env-file ./supabase/.env
   ```

2. Issue a translation that exists in the fixture memory:

   ```bash
   curl -s \
     -X POST "http://localhost:54321/functions/v1/translate" \
     -H "Content-Type: application/json" \
     -d '{"source_lang":"en","target_lang":"fr","text":"good morning"}' | jq
   ```

   The response shows `origin: "tm"` and the forward hit counter incremented by
   one (from 12 to 13 in the bundled fixture).

3. Request the reverse direction for one of the seeded fixtures:

   ```bash
   curl -s \
     -X POST "http://localhost:54321/functions/v1/translate" \
     -H "Content-Type: application/json" \
     -d '{"source_lang":"fr","target_lang":"en","text":"bonjour"}' | jq
   ```

   Because the source text matches the `target_text` of the existing `en>fr`
   row, the response contains `target_text: "good morning"` and the
   `reverse_hits` counter increases.

4. Request a segment that is not seeded (for example `"new eco lodges"`). The
   handler returns a `[fr] new eco lodges` synthetic translation, writes it back
   through the same fixture map, and reports `persisted: false`. Re-running the
   same request now produces `origin: "tm"` with the cached value and hit count
   of 1.

5. Inspect the admin console at `/translations`. The search input and filter by
   direction (`en→fr`, `en→sw`, etc.) reflect the same fixture rows, while the
   edit drawer records mock updates via console logs until live tokens are
   available.

These steps prove the lookup ordering, persistence behaviour, and hit counter
increments without needing a live model provider.
