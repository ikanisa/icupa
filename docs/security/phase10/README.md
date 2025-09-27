# Phase 10 Security Deliverables Archive

This folder is reserved for the penetration testing partner engaged in Phase 10. Store all reports, attestations, and remediation trackers here so Security can reference the artefacts alongside the wider documentation set.

## Expected contents

| File | Description |
| --- | --- |
| `01-threat-model.pdf` | Optional threat briefing shared during Week 18.1. |
| `02-test-plan.pdf` | Approved OWASP ASVS L2 coverage plan. |
| `03-findings-report.pdf` | Full vulnerability report with CVSS scoring and reproduction steps. |
| `04-remediation-tracker.xlsx` | Status of mitigation actions agreed with ICUPA Core. |
| `05-attestation-letter.pdf` | Final confirmation that outstanding issues are resolved. |

Sensitive artefacts should be encrypted at rest. When publishing to the repository, use the company-managed Git-crypt key or encrypt files before committing. Only redacted summaries should appear in public pull requests.

## Submission checklist for vendors

- ✅ Report references the Phase 10 scope (PWA, Supabase, Edge Functions, agents service).
- ✅ All High/Critical issues include mitigation proposals and verification evidence.
- ✅ RLS black-box tests and CSP/HSTS/SameSite evidence attached.
- ✅ Secrets scanning output (`trufflehog` or equivalent) included.
- ✅ Findings logged in Linear with `external` and `security` labels.

Questions or escalations should be raised in `#sec-phase10` and the Security Lead tagged for same-day responses.
