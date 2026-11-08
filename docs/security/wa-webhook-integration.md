# Meta WhatsApp webhook durable inbox — integration and release gates

**State: SOURCE IMPLEMENTED / REVIEW REQUIRED. Not deployed. No live project exposed by connected Supabase account.**

The new isolated Edge function is \`supabase/functions/meta-wa-webhook/index.ts\`.
The code uses the existing reviewed \`metaWebhookGuard.ts\` (in recovery PR #212), which validates raw Meta HMAC, WABA/phone bindings and non-retired sender IDs before calling the durable inbox.
In the proposed backend, an envelope and *every* semantic event are committed in ONE Postgres RPC transaction before an HTTP 200 is returned. All message content is sealed with AES-256-GCM in Edge before reaching the database. Event identity hashes and source IDs are stored for deduplication. Records default to **held**, and no worker sends outbound WhatsApp or AI replies.

## Installation (not yet performed)
1. Obtain the REAL Supabase project owner/ID and independently review the live schema, data policy and role grants. No project is visible through the connected Supabase plugin.
2. On an authorised project, use the locally installed Supabase CLI to run \`supabase migration new meta_wa_webhook_inbox\`. Copy \`docs/security/wa-webhook-review.sql\` into that CLI-created migration, inspect it with your database administrator, deploy it to staging, and run grant/RLS SQL tests. The review SQL has NOT been executed.
3. Deploy the **isolated** \`meta-wa-webhook\` function (not the multipurpose \`auth\` route). The config.toml flag disables the gateway JWT check only for that external callback. Meta's X-Hub-Signature-256 still verifies every POST.
4. Set private Edge secrets (never source-control or chat): \`WA_VERIFY_TOKEN\`, \`WA_APP_SECRET\`, \`WA_WEBHOOK_ALLOWED_BINDINGS\` (exact WABA:phone pairs), \`WA_WEBHOOK_AES256_KEY_B64\` (32 independently generated random bytes, base64), \`WA_WEBHOOK_KEY_VERSION\`, \`SUPABASE_URL\`, \`SUPABASE_SERVICE_ROLE_KEY\`, and \`WA_SUPABASE_EXPECTED_HOST\`.
5. Run staging signed GET/POST, replay, tamper, batch-rollback, key-rotation, auth-privilege and crash tests. Only THEN set \`WA_WEBHOOK_INGESTION_ENABLED=true\`. Otherwise valid POSTs fail closed with 503.
6. Update the **real Meta app** callback URL only after server-side account restoration and test subscriber verification. No live callback or credential has been changed.
7. Decide lawful retention and legal-hold requirements before enabling background cleanup. Until then, rows are held and neither exported nor auto-deleted.
8. No login/session minting, outbound WhatsApp, auto-replies, AI calls, Twilio sender registration, or Meta restriction bypass is included.

## Security constraints
- No \`SECURITY DEFINER\` function. The proposed \`public.wa_ingest_verified_envelope\` is \`SECURITY INVOKER\`, explicit \`service_role\` only, and returns a commit receipt. The private tables are not exposed to anonymous/authenticated users.
- Fail closed on invalid signing, wrong WABA/phone, ambiguous RPC outcome or missing keys. Duplicate events are not reprocessed; a conflicting event ID with changed content fails the entire envelope. Status events with different status/timestamp are distinct.
- Never treat \`200 accepted by Meta\` as proof a customer message was delivered. This handler *only* persists signed inbound events.
- The old auth router and both legacy OTP endpoints remain paused in recovery PR #212. A compliant OTP replacement is a separate, gated workstream.
- Never re-enable a suspended WABA, retired Togo phone or live sender solely by changing environment flags.
