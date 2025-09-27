# Phase 2 Outsourcing Playbook

Phase 2 links the diner experience to physical tables using signed QR payloads, Supabase Edge Functions, and strict RLS headers. This playbook coordinates the external partners who harden the QR lifecycle, validate session isolation, and exercise the mobile flows while ICUPA Core focuses on later phases.

## 1. Governance & Contacts

| Track | Vendor role | Internal owner | Slack channel | Weekly checkpoint |
| --- | --- | --- | --- | --- |
| QR security | Offensive security contractor validating QR signing keys and rotation runbooks | Platform Lead – J. Habimana | #qr-security | Mon 15:00 CET |
| Session enforcement | Supabase QA partner executing regression suites and manual isolation tests | Security Lead – M. Grech | #session-rls | Wed 11:00 CET |
| Mobile journeys | Mobile QA house recording QR → menu → cart bootstrap on target devices | Product Lead – N. Uwase | #pwa-mobility | Thu 09:30 CET |

All partners operate under the ICUPA NDA plus GDPR/Rwanda DPL processor addendum. Access is staging-only and expires one week after Phase 2 acceptance unless renewed by the Phase Coordinator.

## 2. Shared prerequisites

- **Environment bundle** – Staging Supabase credentials, the `supabase/tests/` suite, and the Playwright scaffolding under `tests/playwright/` for spot checks.
- **Documentation** – [`docs/implementation-plan.md`](../implementation-plan.md) Phase 2 section, the QR administration guide in [`README.md`](../../README.md), and inline comments inside [`supabase/functions/create_table_session/index.ts`](../../supabase/functions/create_table_session/index.ts).
- **Issue tracking** – Log all findings in Linear with labels `external`, `phase2`, and the relevant track (`qr`, `session`, or `mobile`).
- **Observability** – Read-only Supabase logs, QR signing metrics surfaced through Cloud Logging, and access to device farm dashboards when remote hardware is used.

## 3. QR security vendor scope

### Deliverables

1. **Key rotation rehearsal** – Validate the rotation runbook, confirming new signing keys register correctly and old keys are revoked. Upload evidence to `artifacts/phase2/qr-security/`.
2. **Signature tamper report** – Attempt to forge or replay QR payloads, documenting failures and successes in [`docs/outsourcing/notes/phase2-qr-rotation.md`](notes/phase2-qr-rotation.md).
3. **Runbook updates** – Propose improvements to the admin QR tooling and incident response paths captured in `docs/outsourcing/notes/phase2-qr-rotation.md`.

### Acceptance criteria

- Rotation rehearsal covers both Rwanda and Malta tenant samples with timestamps and Supabase audit references.
- Tamper report includes raw payloads, reproduction steps, and Linear ticket IDs for any accepted findings.
- Runbook updates approved by the Platform Lead and reflected in the README before vendor sign-off.

### Timeline

| Week | Milestone |
| --- | --- |
| W3.1 | Kick-off, access provisioned |
| W3.2 | Rotation rehearsal + tamper testing completed |
| W3.3 | Final recommendations accepted |

## 4. Session enforcement vendor scope

### Deliverables

1. **Supabase regression runs** – Execute `supabase/tests/rls_orders.sql` plus targeted SQL proving diners cannot access other sessions. Store CLI output in `artifacts/phase2/session-audits/`.
2. **Edge Function probes** – Call `create_table_session` with invalid signatures, expired tokens, and replay attempts, logging outcomes inside [`docs/outsourcing/notes/phase2-session-regression.md`](notes/phase2-session-regression.md).
3. **Incident drill** – Simulate compromised session headers, document detection, and recommend monitoring hooks for ICUPA’s observability stack.

### Acceptance criteria

- Regression logs include command invocations, exit codes, and references to Supabase audit trails.
- Edge Function probes enumerate each failure path with the expected HTTP status and any headers returned.
- Incident drill notes list alert destinations and backlog items to enhance monitoring, signed off by Security Lead.

### Timeline

| Week | Milestone |
| --- | --- |
| W3.1 | Regression tooling walkthrough |
| W3.2 | Full isolation + probe coverage |
| W3.3 | Incident drill playback |

## 5. Mobile journeys vendor scope

### Deliverables

1. **Device matrix** – Catalogue tested devices/OS versions, stored in [`docs/outsourcing/notes/phase2-mobile-qa.md`](notes/phase2-mobile-qa.md) with artefacts in `artifacts/phase2/mobile-journeys/`.
2. **Journey recordings** – Capture QR scan → session confirmation → menu render on representative Android and iOS hardware.
3. **Defect log** – Raise UX or accessibility gaps (e.g., screen reader focus, offline prompts) with evidence links and recommended fixes.

### Acceptance criteria

- Matrix covers at least two Android and two iOS versions, including one low-bandwidth simulation.
- Recordings highlight latency measurements and note whether the background sync banner appears when offline.
- Defect log categorised by severity with owner + due date, reviewed by Product Lead.

### Timeline

| Week | Milestone |
| --- | --- |
| W3.1 | Device plan approved |
| W3.2 | Recording batch delivered |
| W3.3 | Defects triaged + retest slots booked |

## 6. Communication & escalation

- Track-specific stand-ups twice per week with minutes appended to the relevant note files under `docs/outsourcing/notes/`.
- Escalation path: Vendor PM → Track owner → Phase 2 Coordinator → CTO.
- Sev-1 incidents (QR compromise or RLS bypass) trigger the security incident procedure and immediate Slack paging in `#eng-leads`.

## 7. Completion checklist

- [ ] Key rotation rehearsal artefacts uploaded and reviewed.
- [ ] Session isolation regressions signed off with incident drill outcomes documented.
- [ ] Mobile QA recordings stored with all defects logged and triaged.
- [ ] Vendor access revoked; retrospectives filed in `docs/outsourcing/notes/`.

## 8. Artefact storage

| Artefact | Location |
| --- | --- |
| QR rotation logs & tamper attempts | `artifacts/phase2/qr-security/` |
| Session regression outputs & probes | `artifacts/phase2/session-audits/` |
| Mobile QA recordings & reports | `artifacts/phase2/mobile-journeys/` |
| Meeting notes & follow-ups | `docs/outsourcing/notes/` |

Following this playbook keeps Phase 2 outsourcing aligned with ICUPA’s security and UX requirements while the core team advances subsequent milestones.
