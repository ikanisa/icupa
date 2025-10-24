# Group Clustering Mocks

The clustering prototype groups overlapping ecoTrip communities and surfaces
match suggestions for both travelers and the operations console. Until the
production services ship, the edge functions rely on static fixtures so that
interfaces and observability can be tested end-to-end.

## Fixtures

- `ops/fixtures/groups_clusters.json` contains two curated clusters. Each record
  includes the anchor group, candidate matches, and per-user recommendations.
- Signals are captured as small objects so downstream clients can render the
  evidence that led to the suggestion (shared itineraries, wishlist alignment,
  supplier overlap, and so on).
- When new scenarios are needed, append to the `clusters` array and keep
  existing entries intact so historical console captures continue to replay.

## Edge Functions

| Function | Call name | Purpose | Deploy command | Health URL |
| --- | --- | --- | --- | --- |
| `groups-match` | `groups.match` | Returns candidate groups for a specific `group_id`. | `supabase functions deploy groups-match --project-ref woyknezboamabahknmjr` | `https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-match/health` |
| `groups-suggest` | `groups.suggest` | Traveler-focused recommendations resolved by `user_id`. | `supabase functions deploy groups-suggest --project-ref woyknezboamabahknmjr` | `https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-suggest/health` |
| `ops-groups-suggestions` | `ops.groups.suggestions` | Ops console view with cluster summaries, filters, and signal payloads. | `supabase functions deploy ops-groups-suggestions --project-ref woyknezboamabahknmjr` | `https://woyknezboamabahknmjr.supabase.co/functions/v1/ops-groups-suggestions/health` |

### Request parameters

- `groups-match`: `GET ?group_id=<uuid>&limit=<1-50>`
- `groups-suggest`: `GET ?user_id=<uuid>&limit=<1-50>`
- `ops-groups-suggestions`: `GET ?tag=<string>&min_score=<0-1>&limit=<1-25>&detail=summary|full`

All functions emit AUDIT logs using `withObs` so operators can trace fixture
usage back to specific requests.

## Database objects

Migration `0024_groups_match.sql` adds two tables under the `group` schema:

- `match_candidates` stores high-signal pairs, similarity metrics, and raw
  signals extracted by the clustering job.
- `match_feedback` captures ops/owner decisions (`confirm`, `dismiss`,
  `duplicate`, `flag`). Ops can write to both tables, while group owners are
  limited to inserting feedback records through RLS policies.

The Supabase run `supabase db push --workdir .` executed after generating the
migration. Output for verification is saved at
`ops/logs/supabase-db-push-groups-match.txt`.

## Observability quick reference

- All mock responses embed a `request_id` and emit `AUDIT` events of the form
  `groups.match`, `groups.suggest`, or `ops.groups.suggestions`.
- Use the function health URLs to confirm deploy status before flipping console
  feature flags back to live data.

## Verification checklist

- `npm run lint` — validates that the Supabase functions and shared helpers pass
  the repository ESLint suite before deploying updated mocks.
