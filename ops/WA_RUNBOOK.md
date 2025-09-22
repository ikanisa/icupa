# WhatsApp Runbook

## Webhook Verification
- Meta will call `GET /functions/v1/wa-webhook?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<random>`.
- Ensure secret `WA_VERIFY_TOKEN` matches the value configured in Meta.
- The function echoes `hub.challenge` when tokens match; otherwise 403.

## Token Rotation
1. Generate new long-lived WhatsApp access token.
2. Run `supabase secrets set WA_ACCESS_TOKEN=<new>` and (if changing sender) `WA_PHONE_ID=<new>`.
3. If Graph version updates, set `WA_GRAPH_BASE` accordingly (default `https://graph.facebook.com/v20.0`).
4. Deploy `wa-send` after updating secrets.

## Simulating Calls
### GET Challenge
```sh
curl -s "https://woyknezboamabahknmjr.supabase.co/functions/v1/wa-webhook?hub.mode=subscribe&hub.verify_token=$WA_VERIFY_TOKEN&hub.challenge=12345" \
  -H "apikey: $SUPABASE_ANON_KEY"
```
Expect `12345` on success.

### POST Message (mock)
```sh
curl -s -X POST "https://woyknezboamabahknmjr.supabase.co/functions/v1/wa-webhook" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d '{
    "entry":[{
      "changes":[{
        "value":{
          "messages":[{"id":"wamid.test","from":"250788000111","type":"text","text":{"body":"plan trip"}}],
          "contacts":[{"wa_id":"250788000111","profile":{"name":"Test User"}}]
        }
      }]
    }]}'
```

## Offline Mode
- Set `WA_OFFLINE=1` (default in this environment) to avoid calling the real Graph API.
- Outbound sends are logged with `mode=mock` in `agents.messages`.
- To send real messages, unset `WA_OFFLINE` and ensure network access plus valid Graph secrets.

## Logs & Transcripts
- All inbound/outbound messages stored in `agents.messages` (via RPC `agent_recent_messages`).
- AUDIT logs:
  - `wa.webhook` – inbound handling.
  - `wa.send` – outbound delivery.

## WhatsApp Chat State Machine
- **States**: `idle`, `pay_requested`, `group_invite`, `group_join`.
- **Transitions**:
  - `idle → pay_requested` when the traveler taps `pay_now` or sends `pay`.
  - `idle → group_invite` when tapping `group_invite` or sending `group`.
  - `group_invite → group_join` when the traveler taps `join_group`.
  - Any state → `idle` on completion (`skip_group`, `contact_support`) or error resets.
- Each inbound webhook updates `agents.chat_state` via `agents.upsert_chat_state`, with invalid transitions returning a polite correction and leaving the state unchanged.
- Button replies are deduplicated by `wa_message_id`; only the first delivery mutates state or triggers outbound sends.

## Incident Response
- If Graph API fails, the helper falls back to mock mode and logs the error for replay.
- Verify orchestrator availability; failures return default replies while capturing the error.
