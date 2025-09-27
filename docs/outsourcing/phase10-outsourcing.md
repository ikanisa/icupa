# Phase 10 Outsourcing Playbook

Phase 10 introduces external support to accelerate test automation, load validation, and security hardening ahead of the GA rollout. This playbook describes how ICUPA Core coordinates contracted vendors, the artefacts they must deliver, and the acceptance gates that map directly to the Phase 10 objectives.

## 1. Governance & Contacts

| Track | Vendor role | Internal owner | Slack channel | Weekly checkpoint |
| --- | --- | --- | --- | --- |
| End-to-end automation | QA partner delivering Playwright suites | QA Lead – A. Byiringiro | #qa-automation | Tue 10:00 CAT |
| Load validation | Performance engineering contractor executing k6 runs | Platform Eng – C. Bartolo | #perf-load | Wed 15:00 CET |
| Security hardening | CRE/penetration testing firm | Security Lead – J. Mutesi | #sec-phase10 | Thu 16:00 CET |

All vendors sign the ICUPA NDA and data processing addendum (GDPR + Rwanda DPL). Access is provisioned through temporary SSO groups with auto-expiry at Phase 10 completion.

## 2. Shared prerequisites

- **Environment access** – Vendors receive staging credentials, feature flag overrides, and read-only Supabase roles. No production data is shared.
- **Documentation bundle** – README, implementation plan, runbooks, architecture diagrams, and API references delivered through the secured vendor portal.
- **Telemetry instrumentation** – OpenTelemetry traces and Sentry access (read-only) to correlate vendor findings with ICUPA observability.
- **Issue tracking** – All findings logged in Linear under the Phase 10 project with labels `external` and track-specific tags (`qa`, `perf`, `security`).

## 3. End-to-end automation vendor scope

### Deliverables

1. **Playwright specs** covering:
   - Diner journey: QR sign-in → menu browse → cart modifications → payment stub → receipt toast.
   - Merchant workflow: realtime KDS updates, floor state changes, promo approvals.
   - Admin governance: AI settings edits, audit trail verification, compliance panel status changes.
2. **CI integration** – Pull request to extend `.github/workflows/ci.yml` with `pnpm playwright test` job gated behind a `PLAYWRIGHT_BASE_URL` secret.
3. **Accessibility snapshots** – Axe scans embedded in the Playwright flow with exported reports.

### Acceptance criteria

- Suites run headless in GitHub Actions and staging; flaky test budget < 2%.
- Screenshots and traces stored in `artifacts/phase10/playwright` with automated retention (30 days).
- Ticket handover for defects includes reproduction steps, impacted releases, and suggested mitigations.

### Timeline

| Week | Milestone |
| --- | --- |
| W18.1 | Kick-off + environment handoff |
| W18.2 | Draft diner scripts in review |
| W18.3 | Merchant/Admin coverage complete |
| W18.4 | CI integration + stabilization |

## 4. Load validation vendor scope

### Deliverables

1. **k6 scenarios** (`scripts/create_table_session.js`, `scripts/payments_webhooks.js`) parameterised for Rwanda and Malta peak loads.
2. **Load profile document** summarising arrival rates, concurrency models, and ramp schedules validated with ICUPA SRE.
3. **Result packs** – HTML and JSON outputs, Grafana dashboards, and actionable tuning recommendations.

### Acceptance criteria

- Demonstrated p95 latency ≤ 250 ms for `create_table_session` and ≤ 400 ms for payment webhooks at agreed peak concurrency.
- Error rate < 0.1% sustained for 15-minute steady state.
- Clear mitigation backlog filed for any SLA deviations (database tuning, Supabase plan adjustments, etc.).

### Timeline

| Week | Milestone |
| --- | --- |
| W18.1 | Scenario design + data seeding plan |
| W18.2 | Dry run against staging |
| W18.3 | Full load execution with observability review |
| W18.4 | Remediation recommendations & sign-off |

## 5. Security hardening vendor scope

### Deliverables

1. **Penetration test plan** aligned with OWASP ASVS L2 coverage, including API, PWA, and Supabase Edge Functions.
2. **Findings report** with CVSS scoring, exploit proof, and remediation guidance.
3. **Policy verification** – CSP/HSTS/SameSite cookie validation evidence, dependency audit summary, and secrets scanning results.

### Acceptance criteria

- No outstanding High/Critical vulnerabilities by the end of Phase 10.
- RLS black-box tests confirm diners cannot access other tenants or sessions.
- Final attestation letter stored in `docs/security/phase10/` with mitigation sign-off from Security Lead.

### Timeline

| Week | Milestone |
| --- | --- |
| W18.1 | Threat briefing + scope confirmation |
| W18.2 | Active testing window |
| W18.3 | Report delivery & remediation workshop |
| W18.4 | Re-test & attestation |

## 6. Communication & escalation

- Daily stand-ups remain internal; vendors join twice-weekly syncs per track.
- Escalation path: Vendor PM → Internal track owner → Phase 10 Coordinator → CTO.
- All Sev-1 findings trigger the incident response process defined in the Phase 10 runbooks.

## 7. Completion checklist

- [ ] Playwright suites merged, CI green, flakes triaged.
- [ ] Load test results meeting latency/error budgets with documented mitigations.
- [ ] Security attestation signed, vulnerabilities addressed, policy checks archived.
- [ ] Knowledge transfer session recorded and stored in the vendor portal.
- [ ] Access for all vendor accounts revoked post-Phase 10.

## 8. Artefact storage

| Artefact | Location |
| --- | --- |
| Playwright scripts & reports | `tests/playwright/` + `artifacts/phase10/playwright/` GitHub Actions archive |
| k6 scripts & dashboards | `tests/k6/` + `artifacts/phase10/load/` + Grafana dashboard export |
| Security findings & attestation | `docs/security/phase10/` (encrypted repository) |
| Meeting notes | Notion → exported PDF saved to `docs/outsourcing/notes/` |

Maintaining this playbook ensures outsourced partners deliver measurable value while preserving ICUPA’s security and compliance posture.
