# Threat Model (STRIDE + LINDDUN)

## Assets & Actors
- Tenant data (orders, compliance records, AI prompts, OTP secrets)
- Supabase Postgres + storage buckets
- Edge functions (auth, notifications, ingestion)
- Agents service (OpenAI orchestration)
- PWAs (vendor, admin) across multi-tenant marketplace
- External APIs: OpenAI, WhatsApp, SIP providers

## STRIDE Analysis
| Threat | Surface | Observations | Mitigations |
| --- | --- | --- | --- |
| Spoofing | OTP auth, Supabase service-role | Missing `maskPhone` helper triggers failure → OTP bypass attempts; service-role fallback lacks tenant assertion | Fix OTP code + add signature verification, enforce tenant_id claims, use Supabase RLS. |
| Tampering | Service workers, edge functions | No SW integrity (no SRI/CSP) and wildcard image hosts risk injection | Add CSP + SRI, signed bundles, Workbox precache manifest validation. |
| Repudiation | Admin actions | No structured audit logs; Supabase functions log to console only | Implement structured logging with user/tenant IDs, store in immutable audit table. |
| Information Disclosure | Supabase service-role, AI prompts | Service-role fallback may expose cross-tenant data; agents logs may contain PII | Require tenant scoping middleware, redact prompts/logs, encrypt sensitive tables. |
| Denial of Service | OTP rate limiting, AI budgets | OTP function enforces rate windows but fails due to exception; AI budgets defined but not enforced at runtime | Fix OTP bug; implement agent cost guard + rate limit middleware. |
| Elevation of Privilege | Admin console | Mock data hides missing RBAC checks; Next wildcard image config may allow asset injection | Enforce RBAC via Supabase policies, restrict remotePatterns, run Playwright RBAC tests. |

## LINDDUN (Privacy)
| Category | Risk | Notes | Mitigations |
| --- | --- | --- | --- |
| Linkability | Session identifiers | Supabase service-role responses may include user IDs accessible cross-tenant | Use tenant-scoped service clients, pseudonymize analytics exports. |
| Identifiability | OTP logs | Missing maskPhone leads to raw phone logs if fixed incorrectly | Use maskPhone in both OTP functions, log hashed identifiers only. |
| Non-repudiation | Audit logs | Lack of immutable audit trails | Append-only audit table, sign log entries. |
| Detectability | Offline mode | Without SW, requests fail silently revealing user presence | Provide offline fallback messaging, exponential backoff. |
| Disclosure | AI prompts & outputs | Agents may log PII to OpenAI without filtering | Add prompt scrubbing, minimize context to tenant scope, apply DLP filters. |
| Unawareness | Consent flows | Multi-vertical features lack privacy notices | Add per-domain consent modals, GDPR/CCPA compliance docs. |
| Non-compliance | Data residency | No regional data residency enforcement yet | Tag data by region, enforce Supabase project per region, document transfers. |

## Mitigation Roadmap
1. Patch OTP function, add integration tests, enable structured audit logs with tenant context.
2. Apply CSP/HSTS, Workbox SW, offline fallback pages with caching.
3. Implement tenant assertion middleware for service-role usage; add query guards.
4. Introduce AI governance gating: prompt redaction, allowlists, rate limits.
5. Establish privacy notices and data residency controls per domain vertical.
