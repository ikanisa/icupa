# AI Agent Governance Plan

## Current State
- Agents service (`agents-service/`) configures OpenAI access, budgets, and Supabase connectivity but lacks explicit enforcement of budgets, tool allowlists, and tenant scoping in runtime logic.
- PWAs surface numerous agent-driven workflows (menu ingestion, compliance, finance) without requiring user confirmations.
- No prompt injection or jailbreak regression suite exists; logs may capture sensitive PII without redaction.

## Policies
1. **Capability Allowlist**
   - Define JSON allowlist mapping tenant roles → permitted tools (`menu_ingest`, `finance_payout`, `voice_call`, etc.).
   - Deny-by-default; require explicit approval before enabling new tools per tenant.
2. **Budget & Rate Limits**
   - Enforce `AGENT_SESSION_BUDGET_USD` and `AGENT_DAILY_BUDGET_USD` in agents runtime; reject calls exceeding quotas and notify admins.
   - Add per-tenant request throttling (burst 5/min, sustained 60/hour) with circuit breaker on repeated failures.
3. **Prompt Hygiene**
   - Strip PII from prompts (phone, email, location) using regex + allowlist of safe fields.
   - Apply jailbreak detection heuristics and escalate to human review for suspicious prompts.
4. **Human-in-the-Loop**
   - Require dual approval for finance, compliance, or onboarding actions initiated by agents.
   - Provide UI prompts summarizing agent intent, awaiting confirmation.
5. **Logging & Auditing**
   - Log structured events (`tenant_id`, `agent_id`, `tool`, `cost_usd`, `prompt_hash`) to tamper-evident store.
   - Retain prompts for 30 days max; support DSAR deletion.
6. **Testing & Monitoring**
   - Build red-team test suite with adversarial prompts; run nightly.
   - Monitor latency/cost budgets, send alerts when exceeding thresholds.
7. **Data Residency**
   - Route prompts through region-specific OpenAI endpoints when available; avoid cross-region data transfer without consent.

## Implementation Roadmap
- Week 1: Add middleware in agents service enforcing allowlists + budgets, with tests.
- Week 2: Integrate prompt scrubber and jailbreak detector; publish policy doc in repo.
- Week 3: Add governance dashboard in Admin PWA showing agent usage, approvals, violations.
- Week 4: Conduct tabletop exercise for incident response (prompt injection, abuse, data leak).
