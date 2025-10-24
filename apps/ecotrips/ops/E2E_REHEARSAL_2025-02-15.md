# E2E Deployment Rehearsal – 2025-02-15

## Scope
- Apps: `apps/client`, `apps/admin`
- Infrastructure: Supabase project `woyknezboamabahknmjr`

## Timeline
| Time (UTC) | Step | Notes |
| ---------- | ---- | ----- |
| 09:00 | Branch created | `release/2025-02-15-e2e` cut from `staging`. |
| 09:20 | GitHub Actions | Workflow `ci/full` green (build, lint, typecheck). Artifact archived at `actions://ci/full/1892`. |
| 09:40 | Supabase migration | Applied `20250215093000_add_booking_indexes.sql` via `supabase migration up`. No drift detected. |
| 10:10 | Synthetic smoke | `scripts/synthetics/run-smoke.mjs --base-url <preview>` returned 200 for all probes. |
| 10:25 | Manual QA | Admin + client checklists signed off by ops (see `ops/QATEST_LOG.md`). |
| 10:40 | Promotion | Preview promoted to staging via `scripts/pipelines/promote.mjs`. |
| 11:10 | Tag | `git tag -a v0.4.0-rc.1 -m "E2E rehearsal"` pushed to origin. |

## Findings
- Supabase migrations completed in <30s; no blocking locks observed.
- Synthetic monitor `synthetics/preview` surfaced 2xx latencies under 400ms.

## Follow-ups
- Automate attachment of rehearsal logs to GitHub releases.
- Add staging smoke summary to pager rotation digest.
