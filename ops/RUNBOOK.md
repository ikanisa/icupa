# Ops Console Runbook (Offline Mode)

## Check bookings in a date range
```sh
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "https://woyknezboamabahknmjr.supabase.co/functions/v1/ops-bookings?from=2025-10-01&to=2025-10-15"
```
- Add `&supplier=<code>` to narrow by supplier (max 64 chars).
- Response includes `request_id`; reference it when escalating.

## List exceptions by status (and prepare retry)
```sh
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "https://woyknezboamabahknmjr.supabase.co/functions/v1/ops-exceptions?status=open"
```
- Valid statuses: `open`, `retrying`, `resolved`.
- Retry workflow is mocked; note the `request_id` for the future real retry hook.

## Submit a refund request (mock)
```sh
curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"itinerary_id":"11111111-1111-4111-8111-111111111111","amount_cents":15000,"reason":"customer cancellation"}' \
  "https://woyknezboamabahknmjr.supabase.co/functions/v1/ops-refund"
```
- `itinerary_id` must be a UUID, `amount_cents` > 0, `reason` 1–200 chars.
- Response returns `request_id` prefixed with `mock-`.

## Interpreting audit logs
- Each function prints a line like:
  ```
  AUDIT ops.bookings requestId=... actor=bearer details=from=2025-10-01|to=2025-10-15|supplier=|results=2
  ```
- `requestId` matches the payload `request_id`.
- `actor` indicates if an Authorization header was provided.
- `details` omit PII and summarize filters or actions.
- Use `requestId` to correlate console actions, fixture responses, and future real backends.

## Checkout & Webhook (offline)
1. Create checkout intent (status: processing)
   ```sh
   curl -s \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"itinerary_id":"11111111-1111-4111-8111-111111111111","amount_cents":25000,"currency":"USD"}' \
     "https://woyknezboamabahknmjr.supabase.co/functions/v1/bff-checkout"
   ```
   - Response includes `payment_id`, `payment_intent`, and `idempotency`.
   - DB row: `payment.payments` record with `status=processing`.

2. Mark success via webhook
   ```sh
   curl -s \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"type":"payment_intent.succeeded","data":{"payment_id":"<payment_id>","payment_intent":"<payment_intent>"}}' \
     "https://woyknezboamabahknmjr.supabase.co/functions/v1/stripe-webhook"
   ```
   - Expected: `provider_ref` populated, `status=succeeded`.

3. Mark failure via webhook
   ```sh
   curl -s \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"type":"payment_intent.payment_failed","data":{"payment_id":"<payment_id>","payment_intent":"<payment_intent>"}}' \
     "https://woyknezboamabahknmjr.supabase.co/functions/v1/stripe-webhook"
   ```
   - Expected: `status=failed` and an `audit.events` entry noting the failure.

4. Audit tracing
   - Checkout and webhook handlers print `AUDIT` lines with `requestId`, actor, amounts, and results.
   - Use the `payment_id` and `requestId` to reconcile database status with logs.

## Switching data source
- The Ops Edge Functions serve live data by default. Set `USE_FIXTURES=1` when you need offline fixtures.
- To use live Supabase views, run:
  ```sh
  supabase secrets set USE_FIXTURES=0 --project-ref woyknezboamabahknmjr
  ```
- Reverting to fixtures:
  ```sh
  supabase secrets set USE_FIXTURES=1 --project-ref woyknezboamabahknmjr
  ```
- Live view access requires the caller to have `core.profiles.persona = 'ops'` (see `ops/ACCESS.md`).
- After toggling, the next request automatically switches source; redeploy only if code changes.

## Catalog search index
```sh
curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/search-index-populate" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```
- Seeds `catalog.search_index` with curated fixtures. `seeded` reflects upserts; `fallback=true` means Supabase service role env is missing.
```sh
curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/search-places" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"kigali","limit":5}'
```
- Returns ranked suggestions with `matches` for highlighting. Offline mode sets `source="fixtures"` and `fallback=true` so the client can show cached autosuggest data.

## Inventory triage
- **Circuit breaker state**: `AUDIT inventory.search` / `AUDIT inventory.quote` logs include `circuit`=`closed|open|half-open`. If stuck `open`, the cooldown is 60s; cached responses (`source="cache-stale"`) continue serving.
- **Rate limit pressure**: When HBX returns `429`, the functions retry up to 3 times with exponential backoff (250ms, 500ms, 1000ms). Persistent rate limits escalate `ERROR_CODES.RATE_LIMITED`; wait at least 60s before reattempting bulk calls.
- **Enable fixtures quickly**: Run `supabase secrets set INVENTORY_OFFLINE=1 --project-ref woyknezboamabahknmjr` and redeploy the three inventory functions. Confirm in logs that `source="fixtures"` appears and cache entries continue to populate for subsequent live replays.

## Finance Ops
- **Generate invoice**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/fin-invoice-generate" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"kind":"invoice","payment_id":"<payment_uuid>","itinerary_id":"<itinerary_uuid>"}'
  ```
  - Response returns `number` (e.g. `INV-20250921-0001`) and a `signed_url`. Re-running returns the same invoice with a refreshed link.
- **Deliver via WhatsApp**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/wa-send" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"type":"link_notice","to":"<whatsapp_msisdn>","text":"Your ecoTrips invoice","url":"https://woyknezboamabahknmjr.supabase.co/storage/v1/object/sign/..."}'
  ```
  - Offline mode (`WA_OFFLINE=1`) stores the message and logs `mode=mock`.
- **Create credit note after refund**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/fin-invoice-generate" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"kind":"credit_note","payment_id":"<payment_uuid>"}'
  ```
  - Uses the latest `refund_succeeded` ledger amount. If an invoice exists, the credit note number appends `-CN`.
- **Ledger reconciliation**
  ```sh
  curl -s "https://woyknezboamabahknmjr.supabase.co/rest/v1/fin.ledger?payment_id=eq.<payment_uuid>&order=occurred_at" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Accept-Profile: fin"
  ```
  - Expected sequence: `intent_created` → `capture_*` → `refund_*`. Provider refs act as idempotency keys.

## Privacy Ops
- **Receive request**: Users call `privacy-request`; ops can list records via `privacy_get_datamap` and `privacy_get_request` RPCs.
- **Review**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/privacy-review" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"request_id":"<uuid>","decision":"approve","note":"looks good"}'
  ```
- **Data export**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/privacy-export" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"request_id":"<uuid>"}'
  ```
  - Response includes `signed_url`; deliver via `wa-send` `link_notice`.
- **Erasure dry-run**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/privacy-erasure-dryrun" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"request_id":"<uuid>"}'
  ```
  - Saves plan to `privacy_plans/<id>_plan.json` and returns action counts.
- **Erasure execute**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/privacy-erasure-execute" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"request_id":"<uuid>","confirm":"ERASE"}'
  ```
  - Removes/redacts data per `privacy.data_map`, deletes export artifacts, and writes `audit.events` entry via `privacy_log_audit`.

## Permits Workflow
1. **Traveler submission**
   ```sh
   curl -s \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"park":"Volcanoes","visit_date":"2025-12-12","pax_count":2,"note":"Honeymoon trek"}' \
     "https://woyknezboamabahknmjr.supabase.co/functions/v1/permits-request"
   ```
   - Required fields: `park` (Volcanoes|Nyungwe|Akagera), `visit_date` (YYYY-MM-DD), `pax_count` (>0).
   - Optional: `note`. Authenticated users attach their `user_id`; anonymous requests set `user_id=null`.

2. **Ops approval**
   ```sh
   curl -s \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer <ops_jwt_or_service_role>" \
     -H "Content-Type: application/json" \
     -d '{"request_id":"<uuid>","note":"Permit confirmed"}' \
     "https://woyknezboamabahknmjr.supabase.co/functions/v1/permits-ops-approve"
   ```
   - Only users with persona `ops` (see `ops/ACCESS.md`) or service role can approve.
   - Status transitions from `pending` → `approved`; note is appended with timestamp + operator id.

3. **Ops rejection**
   ```sh
   curl -s \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer <ops_jwt_or_service_role>" \
     -H "Content-Type: application/json" \
     -d '{"request_id":"<uuid>","note":"Need different date"}' \
     "https://woyknezboamabahknmjr.supabase.co/functions/v1/permits-ops-reject"
   ```
   - Only pending requests can be rejected; note captures the reason.

4. **Audit trails**
   - Each function prints a single line, e.g.:
     - `AUDIT permits.request requestId=... actor=user-uuid park=Volcanoes visit=2025-12-12 pax=2 status=pending`
     - `AUDIT permits.approve requestId=... actor=user-uuid target=<request_uuid> status=approved`
     - `AUDIT permits.reject requestId=... actor=service-role target=<request_uuid> status=rejected`
   - Use the `request_id` to reconcile DB rows (`permits.requests`) with logs.

5. **Data sources**
   - Live views (`ops.v_bookings`, `ops.v_exceptions`) remain controlled by `sec.is_ops`.
   - Fixtures remain available when `USE_FIXTURES=1` is enabled.

## Groups & Split-Pay (v1)
1. **Create escrow (owner or ops)**
   ```sh
   curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-create-escrow" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer <owner_or_ops_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"group_id":"<group_uuid>","itinerary_id":"<itinerary_uuid>","target_cents":50000,"min_members":3,"deadline":"2025-12-31T23:00:00Z"}'
   ```
   - Owners must already be members with role `owner`.
   - Deadline must be in the future; status defaults to `open`.

2. **Join group**
   ```sh
   curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-join" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer <member_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"group_id":"<group_uuid>"}'
   ```
   - Responds with `member_id`. Subsequent calls return the existing membership.

3. **Contribute to escrow**
   ```sh
   curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-contribute" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer <member_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"escrow_id":"<escrow_uuid>","amount_cents":2500,"currency":"USD"}'
   ```
   - Records a payment intent via `payment.ensure_payment_record` and stores the contribution.
   - Response includes `contribution_id`, `payment_id`, and the recalculated `escrow_status`.

4. **Status transitions**
   - `open`: collecting contributions.
   - `met`: contributions >= target AND distinct contributors >= `min_members` before deadline.
   - `expired`: deadline passed without meeting target.
   - `cancelled`: future admin workflow (not automated yet).
   - `paid_out`: reserved for future payout automation.
   - Payout execution is deferred; funds remain as pending payments for now.

5. **Audit logging**
   - Each endpoint prints a single `AUDIT groups.*` line with `requestId`, actor, target IDs, and summary outcome.
   - Use `requestId` and `escrow_id` to reconcile with `group.escrows` + `group.contributions` tables.

6. **Operator overrides**
   - When called with the service role or an ops persona, optional body fields `user_id` / `member_id` allow acting on behalf of members (useful for manual corrections during offline mode).

## Payouts & Expiry (v1)

1. **When payouts run**
   - `groups-payout-worker` sweeps met escrows on the batch schedule and marks them `paid_out` once the mock payout succeeds.
   - `groups-ops-payout-now` gives ops an on-demand trigger for a single escrow (reuse after fixing data or when the worker is paused).
   - Both endpoints print `AUDIT groups.payout*` lines for every escrow touched; capture them for reconciliation.

2. **Trigger a payout immediately**
   ```sh
   curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-ops-payout-now" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"escrow_id":"<escrow_uuid>"}'
   ```
   - Requires the service role token or an ops persona JWT; response returns `payout_status`, `payout_id`, and totals.

3. **Run the payout report**
   ```sh
   curl -s -X GET "https://woyknezboamabahknmjr.supabase.co/functions/v1/groups-payouts-report?from=2025-01-01&to=2025-01-31" \
     -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
   ```
   - Produces counts grouped by `status` and `currency` plus the 10 most recent payouts for spot checks.

4. **State transitions**
   - `met → paid_out` when payouts succeed (worker or manual trigger).
   - `expired → failed` when contributions existed but expiry blocked a payout (`last_error=expired_no_payout`).

5. **Refunds (future)**
   - Refund automation is not live; track failed expiries for manual follow-up until the refund worker ships.

## Refunds (HITL)
- **Manual refund trigger**
  ```sh
  curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/payments-refund" \
    -H "Content-Type: application/json" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -d '{"payment_id":"<payment_uuid>","amount_cents":5000,"reason":"guest_cancelled"}'
  ```
- Guardrails
  - Service-role only; confirm customer consent & finance approval before execution.
  - Partial refunds must not exceed original amount. Full refunds omit `amount_cents`.
  - Stripe live mode requires connectivity; offline mode logs `MOCK_REFUND` for later replay.
- Outcomes
  - On success, `payment.payments` is marked `refunded` with provider ref suffixed `-refund`.
  - Stripe dashboard (or mock log) should be reconciled during daily close.
