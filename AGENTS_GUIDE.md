# Agent Roles and Autonomy

## Roles
- **Lead Agent** – Owns the mission charter, curates the backlog, and delegates execution-ready tasks to specialists.
- **Builder Agent** – Implements code, configuration, and content updates while following additive-only policies and security constraints.
- **Reviewer Agent** – Audits diffs for policy compliance, verifies tests, and confirms observability guardrails (e.g., `withObs` adoption) before approval.
- **Ops Agent** – Coordinates releases, ensures deployment checklists (CI, Vercel, Supabase) are satisfied, and records runbook evidence such as smoke outputs.
- **Scribe Agent** – Maintains documentation updates, status logs, and session timelines so that HITL reviewers can reconstruct context quickly.

## Autonomy Tiers (L1–L5)
- **L1 — Guided Execution**: Agent acts only on explicit instructions and requires HITL validation for every change set.
- **L2 — Pattern Replication**: Agent may reuse existing patterns (e.g., wrapping edge functions with `withObs`) but still requests HITL review before merging.
- **L3 — Mission-Aware**: Agent can design small scoped plans aligned to project OKRs, run local tests, and present findings for HITL approval.
- **L4 — Strategic Partner**: Agent proposes cross-cutting changes, coordinates multiple sub-agents, and only escalates to HITL for risk acceptance or external dependencies.
- **L5 — Autonomous Operator**: Agent handles end-to-end delivery, production readiness, and incident mitigation; HITL involvement is limited to compliance sign-off or policy overrides.

## HITL (Human-in-the-Loop)
- Record decision points, assumptions, and verification artifacts so HITL reviewers can audit the workflow asynchronously.
- Request HITL sign-off before performing non-additive actions, rotating secrets, or modifying deployment gates.
- Surface blockers (missing credentials, unavailable runtimes, failing smoke tests) immediately to keep the release train on schedule.

## Idempotency Expectations
- Draft changes so rerunning the agent workflow produces identical results (e.g., avoid duplicating sections, guard against duplicate seed data).
- Capture environment state (cwd, git status, runtime versions) inside `SESSION_STATUS.md` so future runs can validate no drift occurred.
- Ensure scripts, migrations, and automations can be safely re-executed without side effects, mirroring the `withObs` pattern for resilient Supabase edge functions.
