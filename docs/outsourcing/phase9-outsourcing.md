# Phase 9 Outsourcing Playbook

Phase 9 focuses on offline resilience and push notification readiness for the diner PWA. This playbook outlines how ICUPA Core engages external specialists to harden service worker behaviour, validate background sync, and prepare messaging operations so the core product team can continue shipping Phase 9 features in parallel.

## 1. Governance & Contacts

| Track | Vendor role | Internal owner | Slack channel | Weekly checkpoint |
| --- | --- | --- | --- | --- |
| Service worker engineering | Workbox strategist implementing caching + sync patterns | Frontend Lead – S. Gasanova | #pwa-offline | Mon 14:00 CET |
| Messaging enablement | Push operations partner configuring VAPID keys + campaign tooling | Lifecycle PM – L. Uwase | #push-activation | Wed 11:00 CAT |
| Offline QA | Device lab executing resilience scenarios across Android/iOS | QA Lead – A. Byiringiro | #qa-offline | Thu 16:00 CET |

All vendors sign the ICUPA NDA and data processing addendum (GDPR + Rwanda DPL). Temporary SSO groups expire one week after Phase 9 sign-off and are revalidated before Phase 10 onboarding.

## 2. Shared prerequisites

- **Environment access** – Staging Supabase credentials with feature flags for push and background sync; production data is never shared.
- **Device matrix** – Approved handset list (Android Chrome, Samsung Internet, iOS Safari/PWA) issued through Mobile Device Management loaners or BrowserStack credits.
- **Documentation bundle** – README excerpts, implementation plan, Phase 9 architecture diagrams, and the queue processing notes in [`docs/runbooks/fiscalization.md`](../runbooks/fiscalization.md) to understand downstream triggers.
- **Issue tracking** – Vendors log all findings in Linear with labels `external` + track-specific tags (`pwa`, `push`, `offline-qa`).
- **Observability** – Read-only Sentry and OpenTelemetry dashboards plus Supabase logs for correlating failures.

## 3. Service worker engineering vendor scope

### Deliverables

1. **Workbox configuration review** – Audit `src/sw.ts` caching strategies and propose diffs ensuring images use CacheFirst+expiry, menu JSON uses StaleWhileRevalidate, and mutations fall back to background sync queues.
2. **Background sync instrumentation** – Expand the queue telemetry published by `useBackgroundSyncToast` so offline replays emit structured metrics stored in `artifacts/phase9/offline/sync-report.md`.
3. **Fallback UX recommendations** – Document offline banners, retry prompts, and install flows covering both desktop and mobile in `docs/outsourcing/notes/phase9-offline-ux.md`.

### Acceptance criteria

- Workbox audit signed off with merged pull requests or redlines for the core team.
- Queue telemetry captures payload counts, replay latency, and error breakdowns with actionable recommendations.
- Offline UX documentation reviewed by Product Design and linked from the implementation plan.

### Timeline

| Week | Milestone |
| --- | --- |
| W16.1 | Kick-off + repo access |
| W16.2 | Workbox audit + caching diffs shared |
| W16.3 | Background sync telemetry patch ready |
| W16.4 | Offline UX report delivered & walkthrough |

## 4. Messaging enablement vendor scope

### Deliverables

1. **VAPID credential rotation plan** – Checklist and Terraform-compatible scripts saved under `artifacts/phase9/push/vapid-rotation.md` detailing how keys are rotated without downtime.
2. **Push campaign playbooks** – Templates for receipt alerts, reorder nudges, and promo teasers housed in `docs/outsourcing/notes/push-campaigns.md`.
3. **iOS install guidance assets** – Localised banners and copy for Kinyarwanda, English, French, Swahili, and Maltese stored in `artifacts/phase9/push/ios-a2hs/`.

### Acceptance criteria

- Rotation plan reviewed by Security with rollback steps and reminder cadence (≥ every 90 days).
- Campaign playbooks include targeting logic, opt-out handling, and compliance notes (GDPR/Rwanda DPL).
- iOS assets pass localisation review and appear in staging banners behind the existing feature flag.

### Timeline

| Week | Milestone |
| --- | --- |
| W16.1 | Credential + tooling audit |
| W16.2 | Draft rotation plan + campaign outlines |
| W16.3 | Asset localisation + approval |
| W16.4 | Final sign-off + knowledge transfer |

## 5. Offline QA vendor scope

### Deliverables

1. **Test matrix** – Device × network plan saved as `tests/offline/phase9-matrix.xlsx` describing offline/online toggles, Airplane mode, and background sync validation steps.
2. **Execution evidence** – Screen recordings, console/network logs, and Supabase traces archived in `artifacts/phase9/offline/runs/` per scenario.
3. **Defect triage pack** – Daily summary in `docs/outsourcing/notes/offline-qa-report.md` with reproduction steps and suspected root cause.

### Acceptance criteria

- Critical flows (menu browse, cart edits, checkout attempt, reconnection replay) pass on all target devices.
- Any failed sync attempts include Supabase request IDs to accelerate debugging.
- QA sign-off includes a regression checklist for future phases.

### Timeline

| Week | Milestone |
| --- | --- |
| W16.1 | Matrix + tooling alignment |
| W16.2 | Dry run with debugging hooks |
| W16.3 | Full execution window |
| W16.4 | Final report & regression pack |

## 6. Communication & escalation

- Track-specific stand-ups happen twice per week; notes shared in the relevant Slack channels.
- Escalation path: Vendor PM → Internal track owner → Phase 9 Coordinator → CTO.
- Sev-1 incidents follow the payments timeout and fiscalisation runbooks and trigger push disablement if needed.

## 7. Completion checklist

- [ ] Workbox audit merged or actioned with follow-up issues.
- [ ] Background sync telemetry + offline UX documentation reviewed and stored.
- [ ] Push rotation plan, campaign templates, and localised assets approved.
- [ ] Offline QA evidence archived with all Sev-1/Sev-2 defects triaged.
- [ ] Vendor access revoked and retro notes stored in `docs/outsourcing/notes/`.

## 8. Artefact storage

| Artefact | Location |
| --- | --- |
| Workbox audit & telemetry notes | `artifacts/phase9/offline/` |
| Push rotation plan + assets | `artifacts/phase9/push/` |
| Offline QA logs & recordings | `artifacts/phase9/offline/runs/` |
| Vendor reports & meeting notes | `docs/outsourcing/notes/` |

Aligning vendors with this playbook ensures Phase 9 resilience goals are met without derailing the core roadmap.
