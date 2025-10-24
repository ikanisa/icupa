# Additive-Only Delivery Rules

## Change Constraints
- Apply **add-only** edits: introduce new files, sections, or configuration entries without rewriting or deleting existing content unless an explicit exception is granted.
- Preserve git history clarity by appending context (e.g., new session snapshots) rather than mutating prior records.

## Secret Handling
- Never commit credentials, tokens, or environment files with real secrets. Redact or reference secure vault locations instead.
- Double-check diffs for accidental inclusion of Supabase keys, Stripe secrets, or private PEM material before requesting review.

## Observability (`withObs` Requirement)
- Supabase edge handlers must wrap request logic with the shared `withObs` helper to emit structured telemetry and request IDs.
- When adding new routes or scripts, mirror existing `withObs` usage and document any deviations for HITL approval.

## Runtime Expectations
- Local tooling targets Node.js **v20.19.4** and npm **11.4.2** (see `SESSION_STATUS.md` snapshots for verification).
- Deno-based scripts (e.g., perf smoke runner) expect Deno **2.x** availability; record any missing-runtime blockers in status logs.
