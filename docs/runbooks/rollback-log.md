# Rollback Log

Document production rollback events, mitigation steps, and follow-up actions. Use this log to satisfy audit requirements and to improve future deployment safety.

| Date | Trigger | Deployment Rolled Back | Validation Steps | Follow-up |
| --- | --- | --- | --- | --- |
| 2025-10-30 | Tenant profile backfill latency regression | Feature flag `tenant.enableNewProfile` disabled for `pilot_*` tenants | `pnpm --filter web test:e2e -- --grep "smoke"`, Supabase checks, Grafana dashboard review | Added batching to `run_tenant_backfill`; scheduled load test |
| _TBD_ |  |  |  |  |

## How to Record a Rollback

1. Capture trigger details (alert, SLO breach, manual QA) and link to incident ticket.
2. Note the exact artifact/version rolled back (Git SHA, container tag, Supabase migration ID, feature flag).
3. List validation checks performed after rollback (tests, dashboards, Lighthouse run).
4. Document follow-up tasks with owners and due dates; reference Jira or GitHub issues.
5. Update `docs/rfc-001-repo-refactor.md` with lessons learned if the rollback uncovers systemic gaps.

## Templates

```markdown
### <Date> — <Trigger>
- Deployment: <component>@<version>
- Rollback Action: <feature flag toggle / deployment revert / migration restore>
- Validation: <tests/dashboards>
- Follow-up: <issues>, <owners>, <due date>
```

Store supporting evidence (screenshots, dashboards, logs) in `artifacts/rollback/<date>-<slug>/`.

