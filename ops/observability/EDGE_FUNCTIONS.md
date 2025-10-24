# Edge Function Deployment Notes

## Supplier Onboard (`supplier-onboard`)
- **Endpoint**: `https://<project-ref>.functions.supabase.co/supplier-onboard`
- **Health**: `GET /supplier-onboard/health`
- **Fixtures**: `ops/fixtures/supplier_onboarding.json`
- **Sample request**:
  ```bash
  curl -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -d '{"supplier_name":"Volcano Hikes","contact_email":"ops@volcanohikes.rw"}' \
    "$SUPABASE_URL/functions/v1/supplier-onboard"
  ```

## Feature Flags (`flags-config`)
- **Endpoint**: `https://<project-ref>.functions.supabase.co/flags-config`
- **Health**: `GET /flags-config/health`
- **Fixtures**: `ops/fixtures/flags-config.json`
- **Notes**: surfaces `client.explain_price.glass`, `client.autonomy_dial`, `client.suggestion_chips.top`

## Analytics Capture (`analytics-capture`)
- **Endpoint**: `https://<project-ref>.functions.supabase.co/analytics-capture`
- **Health**: `GET /analytics-capture/health`
- **Fixtures**: emits audit logs when `USE_FIXTURES=1`
- **Sample event**:
  ```json
  {
    "event": "search_submitted",
    "payload": { "destination": "Kigali", "adults": 2 },
    "session_id": "sess_cli_demo"
  }
  ```

## Offline Coverage (`offline-coverage`)
- **Endpoint**: `https://<project-ref>.functions.supabase.co/offline-coverage`
- **Health**: `GET /offline-coverage/health`
- **Fixtures**: `ops/fixtures/offline_coverage.json`
- **Query params**: `region` filter for partial matches

## Sample Analytics Events

Event Name | Payload
--- | ---
`search_submitted` | `{ "destination": "Nyungwe", "adults": 2, "children": 1 }`
`autonomy_dial_changed` | `{ "level": "guided" }`
`explain_price_rendered` | `{ "currency": "USD", "amount": 182000 }`
`suggestion_chip_selected` | `{ "destination": "Akagera" }`

All analytics payloads are persisted to `analytics.events` with the `request_id` returned from `analytics-capture`.
