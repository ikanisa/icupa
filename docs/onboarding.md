# Engineering Onboarding — ICUPA Repository

**Last Updated:** 2025-11-01

Welcome to ICUPA! This guide accelerates onboarding for engineers working in the refactored mono-repo. Follow each section sequentially during your first week.

## 1. Accounts & Access

1. Request access to GitHub organization and add SSH key.
2. Join Supabase projects (`icupa-staging`, `icupa-prod`) with read-only role; request write access once training complete.
3. Obtain credentials for shared tooling: Vercel, Grafana, LogDNA.
4. Accept invitations to Slack channels: `#eng-platform`, `#release`, `#oncall`, `#ai-agents`.

## 2. Local Environment Setup

```bash
# 1. Install pnpm, Node 18.18.2, Supabase CLI 1.191+
corepack enable
nvm install 18.18.2
curl -fsSL https://supabase.com/docs/guides/cli/install | sh

# 2. Clone repository and bootstrap workspace
git clone git@github.com:icupa/icupa.git
cd icupa
pnpm install

# 3. Start Supabase + seed tenants
pnpm supabase:start
pnpm db:seed

# 4. Launch web + agents dev servers
pnpm --filter web dev
pnpm --filter agents-service dev
```

## 3. Repository Orientation

- **Apps:** `apps/web` (monolithic PWA), `agents-service` (Fastify backend), additional experimental surfaces in `apps/*`.
- **Shared Packages:** `packages/ui`, `packages/config`, `packages/types`, `packages/db`.
- **Libraries:** `libs/*` hold cross-cutting utilities (analytics, observability, design tokens).
- **Supabase:** Database migrations, tests, and edge functions live in `supabase/`.
- **Infra:** Terraform modules for managed services under `infra/` (requires limited access).
- **Docs:** Audience-specific guides under `docs/` (architecture, runbooks, RFCs, compliance).

## 4. Development Workflow

1. Create feature branch from `main` and enable `pre-commit` hooks (`pnpm prepare`).
2. Build incrementally using Turbo:
   ```bash
   pnpm turbo run lint typecheck test --filter=<scope>
   ```
3. For Supabase migrations:
   ```bash
   pnpm supabase:generate migration "<change>"
   pnpm supabase:diff
   pnpm supabase:test
   ```
4. Use feature flags defined in `packages/config/src/flags.ts`; never hardcode tenant IDs in code.
5. Document operational impact in relevant runbooks/RFCs as part of definition of done.

## 5. Testing & Quality Gates

- **Unit Tests:** `pnpm test` (Vitest) with watch mode available per workspace.
- **Integration Tests:** Supabase `db test`, agents-service contract tests (`pnpm --filter agents-service test:contract`).
- **E2E Tests:** `pnpm test:e2e` (Playwright) using seeded tenants.
- **Coverage:** 80% minimum; CI publishes reports to `artifacts/coverage/`.
- **Lighthouse:** `pnpm perf:lighthouse` or rely on scheduled CI job.

## 6. Deployment Awareness

- Production deploys occur weekly on Thursdays. Canary to `demo_icupa` and `pilot_*` tenants precedes GA by 48h.
- Release coordination documented in `docs/release-runbook.md` and `docs/runbooks/go-live.md`.
- Follow feature flag rollout templates stored in `docs/runbooks/zero-downtime-migration.md`.

## 7. Support & On-Call

- Weekday on-call rotation covers 09:00–21:00 CET. Escalate incidents via PagerDuty.
- Use `docs/runbooks/ai-kill-switch.md` for AI failures and `docs/runbooks/payments-timeout.md` for payment outages.
- Update `docs/runbooks/rollback-log.md` with incident summaries and remediation follow-ups.

## 8. Learning Resources

- Architecture overview: `docs/ARCHITECTURE.md`
- Repository structure: `docs/REPOSITORY-STRUCTURE.md`
- Refactor context: `docs/rfc-001-repo-refactor.md`
- Testing strategy: `docs/testing.md`
- Observability: `docs/observability.md`

## 9. First-Week Milestones

| Day | Milestone |
| --- | --------- |
| 1 | Complete access requests and local setup |
| 2 | Ship first doc update PR (typo or clarification) |
| 3 | Pair with teammate on Supabase migration or feature flag change |
| 4 | Implement small feature behind feature flag |
| 5 | Demo work during engineering sync; shadow on-call handoff |

Welcome aboard! Reach out in `#eng-platform` or to your onboarding buddy for help.

