# Offline background sync telemetry

This report aggregates diner background-sync replays recorded in `public.offline_sync_events`.

- Data source: Supabase table populated by the service worker via `useBackgroundSyncToast`.
- Columns capture replay counts, failed operations, latency (ms), queue start/completion timestamps, locale, and user-agent.
- Use this file to paste summaries exported from Supabase (CSV snippets, charts, etc.) during vendor QA.
- Related assets:
  - Raw run artefacts: `artifacts/phase9/offline/runs/`
  - Vendor guidance: `docs/outsourcing/phase9-outsourcing.md`

| Captured at (UTC) | Table session | Location | Replayed | Failed | Latency (ms) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| _Pending_ | | | | | | |
