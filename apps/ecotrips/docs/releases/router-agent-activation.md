# Router-Agent Activation Release Notes

## Summary
- Router-agent smoke suite now runs alongside observability and rehearsal scripts, providing deterministic evidence for WhatsApp pricing, voice fallback, and GDPR logging flows.
- ChatKit preview assets document end-to-end concierge prompts so product, design, and support can validate the activation experience before rollout.
- Compliance guardrails confirm GDPR, privacy export, and audit logging coverage with updated references to Supabase telemetry and agent audit trails.

## Deployment Checklist
1. Execute `npm run test:observability` and `npm run test:rehearsal`; paste the outputs into `DEPLOYMENT_READINESS_REPORT.md`.
2. Upload ChatKit preview screenshots or shareable links here; annotate sign-off names and dates beside each asset.
3. Confirm rollback drill evidence by running `npm run drill:rollback` and attaching the console log excerpt.
4. Capture compliance review notes (open risks, mitigations, owners) and link to supporting documents such as `ops/privacy/DATAMAP.md` and `agents/observability.md`.

> Fallback: If `npm run build --workspace app` triggers a Turbopack panic, archive the webpack build output emitted by `app/scripts/run-next-build.mjs` alongside the readiness evidence so Vercel reviewers can confirm parity.

## Stakeholder Communications
- **Ops & Support:** Share rehearsal outcomes plus rollback confirmation in the #launch-ops channel. Highlight any degraded WhatsApp coverage or pending Supabase credential work.
- **Product & Design:** Circulate ChatKit preview links with context on router-agent routing rules, entry points, and fallback messaging. Collect approval in the design review tracker.
- **Compliance & Legal:** Provide GDPR logging evidence and confirm audit retention windows meet policy. Document any exceptions with remediation timelines.
- **Engineering Leadership:** Summarize overall readiness (smoke tests, previews, compliance) alongside the go/no-go decision window and rollback command sequence.

## Evidence Log
| Date | Artifact | Owner | Notes |
| ---- | -------- | ----- | ----- |
|      |          |       |       |

