# WhatsApp OTP v2: secure source staged; login still disabled

**Status:** The legacy WhatsApp OTP send and verify endpoints stay at HTTP 503
in recovery PR #212. This new OTP core is NOT wired to either endpoint.
There is no live database, approved authentication template, credential store
or qualified session exchange yet, so re-enabling OTP would be unsafe.

## Protocol
- CSPRNG-generated six-digit code (rejection sampling; no Math.random).
- HMAC-SHA256 digest of phone and challenge-bound OTP; 32-byte private pepper.
- Pending challenge written before the provider is called; no raw OTP in DB.
- Only an explicitly allowlisted sender, approved template name and language.
- Provider acceptance must be committed; an ambiguous send becomes 'uncertain'
  and cannot authenticate anyone.
- Atomic, independently retained request audit: max 3 requests per 2 minutes
  per keyed phone hash. Single-use consume locks the row and counts every
  invalid attempt, including phone mismatch, with max 5 attempts.
- Requests have a constrained 60–600 second expiry. An empty or invalid proof
  cannot mint an account/session; the core NEVER creates users or grants roles.
- The Togo sender is blocked. The Rwanda Lifuti sender is not presumed retired,
  but is still gated pending active Cloud API registration and account security.

## Required before release
1. Confirm the actual live authentication model, existing Supabase user/merchant
   schema, identity binding, grant rules and consent before choosing a session
   exchange. Never expose service-role credentials to clients or claim an OTP
   core returns a login session.
2. Install the reviewed SQL through an actual Supabase CLI-created migration
   on a project with verified access, and test transaction rollback, lost
   responses, rate-window boundary, concurrent requests, replay and RLS.
3. Implement a server-only OtpStore calling the service-only RPC and a
   TemplateProvider using an approved authentication template, never free text.
   Record provider message IDs and handle ambiguous acceptance without retries.
4. Add properly authenticated account/session exchange; do not reuse the old
   pseudo-email magiclink flow without a separate account/role security audit.
5. Verify Meta has lifted the relevant WABA lock, that the exact phone is
   Connected and the scoped application system-user token is valid.
6. Run device, backend and gateway integration tests with consenting test
   recipients, then explicitly enable WA_OTP_V2_ENABLED with rollback.
7. Document retention, privacy impact and operator monitoring before deleting
   challenge/audit records.

The SQL under docs/security/wa-otp-review.sql is a reviewed implementation
candidate, NOT executed on production; no Supabase project is currently
visible through the connected plugin. The core's AtomicOtpStore contract
must not be replaced by independent client-side queries.
