# Go-Live Checklist

| Category | Item | Status | Acceptance Criteria |
| --- | --- | --- | --- |
| Auth | WhatsApp OTP edge function patched | ❌ | `maskPhone` helper defined, automated test confirms OTP issuance, deployment verified in staging. |
| PWA | Service workers installed for Staff/Admin | ❌ | Workbox SW precaches core shell, offline fallback route works in Playwright offline test. |
| Security | CSP/HSTS headers enforced | ❌ | Next headers deployed, security scan validates no mixed content or inline script violations. |
| Security | Supabase service-role usage scoped | ❌ | All service-role calls pass tenant ID + RLS verifies isolation; regression tests pass. |
| Governance | AI agent policy published | ❌ | Documented allowlists, cost caps, incident response, red-team tests running in CI. |
| Dependencies | High/Critical CVEs resolved | ❌ | `pnpm audit --prod` returns 0 critical/high; Renovate bot enabled. |
| Observability | OTEL traces + logs shipped | ❌ | Trace IDs propagated from PWAs to Supabase functions and agents service; dashboards live. |
| Performance | Bundle budgets + Lighthouse | ❌ | `analyze:pwa` target >=90 PWA score; route budgets enforced via CI failing gate. |
| Privacy | Data processing agreements | ❌ | Vendor contracts and data maps approved; DSAR tooling available. |
| Domain | Pharmacy compliance | ❌ | Medication catalog flagged, disclaimers present, jurisdiction rules enforced. |
| Domain | Tourism/cancellation policies | ❌ | Multi-currency + cancellation flows documented and tested. |
| Release | CI/CD gated | ❌ | `lint`, `typecheck`, `test`, `test:e2e`, `audit`, `lighthouse` required for merge to main; SBOM artifact stored. |
| Support | On-call + runbooks | ❌ | Pager rotation defined, incident response runbooks published, RTO/RPO agreed. |
