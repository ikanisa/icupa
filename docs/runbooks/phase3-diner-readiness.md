# Phase 3 Diner Readiness Checklist

This runbook captures the functional and operational gates that must be satisfied before enabling the Phase 3 diner experience for production tenants. Treat every item as blocking – the canary rollout should not progress until the owning team signs off and artefacts are stored alongside the referenced locations.

## Table session & identity controls

1. **Signed QR payloads verified** – Confirm the Supabase edge function `create_table_session` rejects tampered or replayed QR payloads. Archive the inspection traces inside `artifacts/phase3/qr-hardening/` and note outcomes in [`docs/outsourcing/notes/phase2-qr-rotation.md`](../outsourcing/notes/phase2-qr-rotation.md).
2. **Session fingerprinting** – Capture and compare device fingerprint hashes in `table_sessions` to ensure duplicate browsers are rejected per the [`docs/runbooks/ai-kill-switch.md`](ai-kill-switch.md) guidance. Document false positives and mitigation in `artifacts/phase3/session-fingerprints/`.
3. **Header propagation** – Validate `x-icupa-session` flows from QR → browser storage → Supabase REST/functions. Execute `supabase/tests/rls_orders.sql` with production-like headers and store the CLI output under `artifacts/phase3/rls-audits/`.

## Diner experience & accessibility

- **Age gate disclosure** – Confirm the age verification modal renders before alcohol items can be added in EU regions. Capture screenshots in `artifacts/phase3/age-gate/`.
- **Accessibility sweeps** – Run `npm run test:accessibility` locally and in CI. File any regressions against the `phase3-accessibility` label and record remediation steps in [`docs/outsourcing/notes/phase3-accessibility.md`](../outsourcing/notes/phase3-accessibility.md).
- **Offline fallback** – Exercise the service worker by loading the menu offline, placing an order, and replaying once connectivity returns. Preserve network/console traces under `artifacts/phase3/offline-runs/`.

## Payments & fiscal readiness

- **Gateway configuration** – Double check PSP credentials, callback URLs, and webhook secrets for Stripe/MTN/Airtel. Update the secure credential store and log sign-off in `docs/security/credentials.md`.
- **Fiscal receipt flow** – Validate the Rwanda EBM and Malta fiscal services return a receipt payload within 60 seconds. Upload the signed receipts to `artifacts/phase3/fiscal-receipts/` and link the trace IDs in [`docs/runbooks/fiscalization.md`](fiscalization.md).
- **Failover messaging** – Confirm diner UI exposes the payment status rails (processing, pending, failure) with the correct copy from `src/components/client/PaymentScreen.tsx`. Capture the copy review in `artifacts/phase3/payment-ux/`.

## Operational sign-off

- **Support readiness** – Share escalation paths and the merchant comms plan with Customer Ops. Attach the sign-off note to `docs/outsourcing/notes/phase3-ops-handoff.md`.
- **Analytics & alerts** – Ensure Phase 3 dashboards (GMV, attach rate, AI guardrails) are visible in the admin console and alerts are wired in Grafana/Slack. Record dashboard URLs in [`docs/implementation-plan.md`](../implementation-plan.md) Phase 3 acceptance criteria.
- **Retrospective checkpoint** – Schedule a 30-minute wash-up with Engineering, Product, and Operations after the first 48h of the canary. File action items in Linear using the `phase3` label.

A Phase 3 launch cannot proceed until all evidence is present, reviewers have initialled the artefacts, and the Programme Lead explicitly clears the gate in the implementation plan.
