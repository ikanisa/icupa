# DPIA & Privacy Review Schedule

ICUPA commits to a Data Protection Impact Assessment (DPIA) every quarter or when launching material features (voice waiter, cross-border data flows, new biometric inputs).

| Quarter | Window | Focus Areas | Owner |
| ------- | ------ | ----------- | ------ |
| Q1 | Jan 10 – Jan 24 | Payments processors, fiscal data retention, AI disclosures | Compliance Lead |
| Q2 | Apr 10 – Apr 24 | Voice assistant telemetry, agent budgets, RLS audits | Compliance + SRE |
| Q3 | Jul 10 – Jul 24 | Merchant analytics, push notifications, GDPR DSR latency | Compliance + Product |
| Q4 | Oct 10 – Oct 24 | Chaos drill outcomes, DPIA updates, third-party contracts | Compliance + Legal |

## Checklist

- ✅ Review Supabase RLS policies and update pgTAP coverage (see `supabase/tests`).
- ✅ Validate DSR function (`supabase/functions/compliance/dsr/`) response time < 24h.
- ✅ Confirm runbooks (payments timeout, AI kill switch, voice readiness) are current.
- ✅ Deliver summary to Legal & DPO; store in secure Confluence space.

Maintain a rolling calendar invite for stakeholders and attach the latest DPIA artifacts.
