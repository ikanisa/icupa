# Agent Guardrails (ecoTrips)

## Core Principles
- Additive-only changes by default; don’t rewrite or delete working code unless explicitly authorized.
- Respect agent/policies/ALLOWLIST.json.
- Never touch or log secrets (.env*, tokens, keys).
- DB changes go only via supabase/migrations/.
- Always open a PR; never push to main.
- If something fails, try the next safe option and note what you tried.

## Safe Operating Rules
- Git: use feature branches feat/<short-slug>.
- CI must pass before requesting merge.
- Add/update ADRs in docs/ when making notable changes.
- Use `supabase db diff` to generate migrations when feasible.

## Review Gates
- Schema changes need a human reviewer.
- No auto-merge if CI fails.

## Communication
- PR must include a short plan, changed files list, test notes, and rollback idea.

