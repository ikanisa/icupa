# Supabase Edge Function API Surface (Reverse-Engineered)

| Path | Method | Auth | Description | Notes |
| --- | --- | --- | --- | --- |
| `/functions/v1/auth/whatsapp_send_otp` | POST | Bearer (`SUPABASE_SERVICE_ROLE_KEY`) for internal, anon for kiosk | Generates OTP, rate-limited per phone; **bug**: missing `maskPhone` helper → runtime failure. |
| `/functions/v1/auth/whatsapp_verify_otp` | POST | Bearer (`SUPABASE_SERVICE_ROLE_KEY`) | Verifies OTP, creates/updates merchant profile, assigns tenant roles. |
| `/functions/v1/notifications/subscribe_push` | POST | Bearer (session JWT) | Persists push subscriptions tied to tenant/user. |
| `/functions/v1/notifications/unsubscribe_push` | POST | Bearer | Removes push subscription. |
| `/functions/v1/notifications/send_push` | POST | Service role | Sends push payloads via Web Push. |
| `/functions/v1/ingest_menu_start` | POST | Service role | Begins menu ingestion workflow, triggers agents service. |
| `/functions/v1/merchant/onboarding_update` | POST | Service role | Updates onboarding metadata for merchants. |
| `/functions/v1/ops/db_health` | GET | Service role or admin secret | Health check for Supabase connectivity. |
| `/functions/v1/voice/session` | POST | Service role | Issues tokens/session for voice agent integration. |
| `/functions/v1/ops/enqueue_test_receipt` | POST | Bearer (service role/admin secret) | Enqueues receipt reconciliation job. |
| `/functions/v1/ops/update_scheduler` | POST | Bearer (service role/admin secret) | Adjusts scheduled jobs for agents. |

## Response Schemas (key endpoints)
### `/auth/whatsapp_send_otp`
```json
{
  "ok": true
}
```
Errors: `rate_limited`, `invalid_phone`, `otp_persist_failed`, `unexpected_error`.

### `/auth/whatsapp_verify_otp`
```json
{
  "session": {
    "access_token": "jwt",
    "refresh_token": "...",
    "expires_in": 3600,
    "token_type": "bearer"
  },
  "user": {
    "id": "uuid",
    "phone": "+250...")
  }
}
```

### `/notifications/subscribe_push`
```json
{
  "status": "subscribed",
  "endpoint": "https://fcm.googleapis.com/..."
}
```
Errors: `invalid_payload`, `missing_auth`, `tenant_not_found`.

## TODO
- Publish OpenAPI 3.1 spec with shared schemas for OTP, notifications, ingestion.
- Add `Authorization` requirements + rate limits to doc.
- Generate API reference automatically via script reading function metadata.
