# Phase 1 Outsourcing Playbook

Phase 1 finalises ICUPA's core Supabase schema, row-level security (RLS), and semantic search scaffolding. This playbook explains how external database specialists contribute while ICUPA Core advances subsequent feature work.

## 1. Governance & Contacts

| Track | Vendor role | Internal owner | Slack channel | Weekly checkpoint |
| --- | --- | --- | --- | --- |
| Schema assurance | Postgres reviewer validating migrations and indexes | Platform Lead – J. Habimana | #db-phase1 | Tue 15:00 CET |
| RLS verification | Security-minded QA partner executing Supabase regression suites | Security Lead – M. Grech | #rls-qa | Wed 12:00 CET |
| Embedding pipeline | Data contractor operating OpenAI embedding refreshes | Data PM – C. Muscat | #search-semantic | Thu 10:00 CET |

All vendors sign the ICUPA NDA and the joint GDPR/Rwanda DPL data processing addendum. Access is provisioned to staging-only Supabase projects with automatic expiry two weeks after Phase 1 sign-off.

## 2. Shared prerequisites

- **Environment access** – Staging Supabase credentials, feature flag overview, and the `supabase/tests/` harnesses needed for CLI-driven verification.
- **Documentation bundle** – [`docs/implementation-plan.md`](../implementation-plan.md) Phase 1 section, the Phase 1 database checklist in [`README.md`](../../README.md), and migration comments found inside `supabase/migrations/`.
- **Issue tracking** – All findings logged in Linear with labels `external`, `phase1`, and the relevant track (`schema`, `rls`, `embeddings`).
- **Observability** – Read-only Supabase query logs plus access to the database diff visualiser so reviewers can reference execution plans when required.

## 3. Schema assurance vendor scope

### Deliverables

1. **Migration diff audits** – Redlines covering additive-only compliance, rollback feasibility, and dependency ordering for every migration touched in Phase 1. Store outputs in `artifacts/phase1/schema-reviews/`.
2. **Index validation memo** – Confirmation that ivfflat indexes and supporting b-tree indexes conform to Supabase guidance, recorded in [`docs/outsourcing/notes/phase1-migration-review.md`](notes/phase1-migration-review.md).
3. **Release readiness checklist** – Signed summary noting any follow-up issues or blockers before migrations are applied to staging/prod mirrors.

### Acceptance criteria

- Each migration review references the exact file path (for example `supabase/migrations/20240215000000_phase1_schema.sql`) and either approves as-is or links a Linear issue describing required changes.
- Index validation covers pgvector `lists` sizing and verifies accompanying unique/foreign key constraints remain enforced.
- Release readiness checklist receives sign-off from the Platform Lead before the vendor account is deprovisioned.

### Timeline

| Week | Milestone |
| --- | --- |
| W2.1 | Kick-off, tooling walkthrough |
| W2.2 | Initial migration reviews delivered |
| W2.3 | Final approvals + readiness checklist handover |

## 4. RLS verification vendor scope

### Deliverables

1. **Supabase regression runs** – Execute `tests/rls_orders.sql` and any supplementary SQL to assert diners are scoped by `x-icupa-session` and staff operate through `user_roles`. Archive CLI outputs within `artifacts/phase1/rls-audits/`.
2. **Access anomaly log** – Populate [`docs/outsourcing/notes/phase1-rls-test-report.md`](notes/phase1-rls-test-report.md) with dated findings, remediation notes, and references to Linear issues or pull requests.
3. **Policy gap analysis** – Short memo identifying future tables requiring Phase 1-equivalent RLS before later milestones promote them to production.

### Acceptance criteria

- Regression evidence includes command invocations, exit codes, and any manual queries executed to reproduce observed failures.
- Any anomaly immediately opens a Linear issue tagged `security` with reproduction steps and recommended mitigation.
- Policy gap analysis approved by the Security Lead with explicit owner + due dates for outstanding work.

### Timeline

| Week | Milestone |
| --- | --- |
| W2.1 | Environment validation + dry run |
| W2.2 | Full regression execution |
| W2.3 | Final report & gap analysis walkthrough |

## 5. Embedding pipeline vendor scope

### Deliverables

1. **Embedding refresh drills** – Run `supabase/functions/menu/embed_items` against the seeded dataset, documenting every invocation in [`docs/outsourcing/notes/phase1-embedding-runbook.md`](notes/phase1-embedding-runbook.md) and storing logs under `artifacts/phase1/embeddings/`.
2. **OpenAI usage ledger** – Summaries of tokens consumed, expected monthly spend, and optimisation recommendations.
3. **Semantic search verification** – SQL snippets that prove cosine similarity queries return the seeded menu items above the acceptance threshold, suitable for inclusion in future automated tests.

### Acceptance criteria

- Each drill records trigger method (manual invoke vs. pg_cron), batch sizing, and verification queries with example outputs.
- Usage ledger aligns with procurement budgets and highlights opportunities for caching or batching to reduce cost.
- Semantic search snippets execute successfully in staging and reference any assets saved to the embeddings artefact folder.

### Timeline

| Week | Milestone |
| --- | --- |
| W2.1 | OpenAI credential validation + dry run |
| W2.2 | Batch refresh + verification queries completed |
| W2.3 | Usage ledger + optimisation recommendations delivered |

## 6. Communication & escalation

- Track-specific stand-ups happen twice per week with notes appended to the relevant files in `docs/outsourcing/notes/`.
- Escalation path: Vendor PM → Internal track owner → Phase 1 Coordinator → CTO.
- Sev-1 incidents immediately notify `#eng-leads` and follow the database incident response procedure documented in Linear.

## 7. Completion checklist

- [ ] All Phase 1 migrations reviewed with artefacts saved in `artifacts/phase1/schema-reviews/`.
- [ ] RLS regression evidence stored and action items logged in Linear.
- [ ] Embedding refresh drills + usage ledger reviewed by Data PM.
- [ ] Vendor access revoked; retrospective notes captured in `docs/outsourcing/notes/`.

## 8. Artefact storage

| Artefact | Location |
| --- | --- |
| Migration review logs | `artifacts/phase1/schema-reviews/` |
| RLS regression outputs | `artifacts/phase1/rls-audits/` |
| Embedding drill logs & usage ledgers | `artifacts/phase1/embeddings/` |
| Meeting notes & action items | `docs/outsourcing/notes/` |

Following this playbook keeps Phase 1 on schedule while ensuring external vendors land their deliverables in consistent, auditable locations.
