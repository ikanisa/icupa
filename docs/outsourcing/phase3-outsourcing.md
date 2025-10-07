# Phase 3 Outsourcing Playbook

Phase 3 delivers the client-facing PWA journey from menu browsing through the payment placeholder while preserving accessibility and performance budgets. This playbook coordinates external UX researchers, accessibility auditors, and performance engineers so ICUPA Core can continue shipping Phase 4+ work without blocking on reviews.

## 1. Governance & Contacts

| Track | Vendor role | Internal owner | Slack channel | Weekly checkpoint |
| --- | --- | --- | --- | --- |
| Accessibility | WCAG 2.2 AA auditor validating axe flows and assistive tech support | Accessibility Lead – L. Niyonsenga | #ux-a11y | Tue 10:00 CET |
| UX research | Mobile field researcher capturing diner feedback & heuristic notes | Product Design Lead – R. Attard | #diner-ux | Wed 14:00 CET |
| Performance | Web perf engineer running Lighthouse + Core Web Vitals diagnostics | Frontend Lead – C. Mutesi | #pwa-performance | Thu 16:00 CET |

All vendors sign the ICUPA NDA, GDPR/Rwanda DPL rider, and are provisioned staging-only credentials with automatic expiry five business days after Phase 3 acceptance.

## 2. Shared prerequisites

- **Environment access** – Deployed staging URL, Supabase anon key, and feature flag matrix for the diner shell.
- **Documentation bundle** – [`docs/implementation-plan.md`](../implementation-plan.md) Phase 3 section, diner UX guidance in [`README.md`](../../README.md), and Figma prototypes linked in Linear.
- **Issue tracking** – Findings filed in Linear with labels `external`, `phase3`, and the relevant track (`accessibility`, `ux`, `performance`).
- **Artefact storage** – Use the dedicated folders under `artifacts/phase3/` for raw exports and append summaries in [`docs/outsourcing/notes/`](notes/README.md).

## 3. Accessibility vendor scope

### Deliverables

1. **Axe regression evidence** – Record `npm run test:accessibility` executions, CLI output, and manual AT spot checks in `artifacts/phase3/accessibility/`.
2. **Assistive technology log** – Document screen reader, switch control, and keyboard findings inside [`docs/outsourcing/notes/phase3-accessibility-audit.md`](notes/phase3-accessibility-audit.md).
3. **Remediation tracker** – File Linear issues for any blockers, noting severity, reproduction steps, and proposed fixes.

### Acceptance criteria

- Axe results include command output, failure screenshots, and the commit hash tested.
- Manual AT notes cover VoiceOver (iOS), TalkBack (Android), and desktop screen readers across at least two browsers.
- Remediation tracker receives sign-off from the Accessibility Lead before vendor off-boarding.

### Timeline

| Week | Milestone |
| --- | --- |
| W4.1 | Kick-off & tooling validation |
| W4.2 | Full axe regression & AT sweep |
| W4.3 | Fix verification & sign-off |

## 4. UX research vendor scope

### Deliverables

1. **Field study reports** – Collect diner journey videos, heatmaps, and qualitative notes, storing exports in `artifacts/phase3/ux-research/`.
2. **Heuristic evaluation** – Populate [`docs/outsourcing/notes/phase3-ux-evaluation.md`](notes/phase3-ux-evaluation.md) with severity-ranked observations and design recommendations.
3. **Install & offline checklist** – Confirm Add-to-Home-Screen guidance, push prompts, and offline messaging in multiple locales; log outcomes in Linear with screenshots.

### Acceptance criteria

- Reports cite participant demographics, device mix, and task completion rates.
- Heuristic write-up links to specific Figma frames or code paths and calls out quick wins vs. roadmap items.
- Install/offline checklist confirms copy accuracy for iOS Add-to-Home-Screen instructions and offline banners.

### Timeline

| Week | Milestone |
| --- | --- |
| W4.1 | Research plan review |
| W4.2 | Field sessions executed |
| W4.3 | Playback & recommendations delivered |

## 5. Performance vendor scope

### Deliverables

1. **Lighthouse runs** – Execute mobile Lighthouse (Moto G4, 4G throttle) and upload JSON/HTML reports to `artifacts/phase3/lighthouse/`.
2. **CWV dashboard** – Summarise LCP, TTI, CLS, and FID readings plus bottleneck analysis within [`docs/outsourcing/notes/phase3-lighthouse-report.md`](notes/phase3-lighthouse-report.md).
3. **Optimisation backlog** – Create Linear issues for any regressions above thresholds (LCP > 2.5 s, TTI > 2.0 s) with evidence and mitigation suggestions.

### Acceptance criteria

- Lighthouse scores ≥ 90 for Performance, Accessibility, and PWA categories, with raw exports retained for audit.
- CWV dashboard references the exact build hash, network conditions, and includes filmstrip or trace snippets for problem areas.
- Optimisation issues tagged with owners and due dates before Phase 4 QA begins.

### Timeline

| Week | Milestone |
| --- | --- |
| W4.1 | Baseline Lighthouse run |
| W4.2 | Optimisation retest |
| W4.3 | Final report & handover |

## 6. Communication & escalation

- Track-specific stand-ups occur twice per week with notes appended to the relevant files in `docs/outsourcing/notes/`.
- Escalation path: Vendor PM → Track owner → Phase 3 Coordinator → CTO.
- Sev-1 incidents immediately page `#eng-leads` and follow the diner incident runbook in Linear.

## 7. Completion checklist

- [ ] Axe regression logs uploaded to `artifacts/phase3/accessibility/`.
- [ ] Field study and heuristic notes captured under `docs/outsourcing/notes/`.
- [ ] Lighthouse exports archived with issues raised for any failing budgets.
- [ ] Vendor access revoked and retrospective notes recorded.

## 8. Artefact storage

| Artefact | Location |
| --- | --- |
| Axe + AT evidence | `artifacts/phase3/accessibility/` |
| Lighthouse JSON/HTML | `artifacts/phase3/lighthouse/` |
| Field study exports | `artifacts/phase3/ux-research/` |
| Meeting notes & checklists | `docs/outsourcing/notes/` |

Following this playbook keeps Phase 3 compliant with accessibility, UX, and performance expectations while ICUPA Core advances payments, receipts, and agent workstreams.
