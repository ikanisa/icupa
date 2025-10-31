# Voice Agent - Production-Ready Twilio to OpenAI Realtime Integration

## Overview

The Voice Agent connects Twilio's phone system to OpenAI's Realtime API, enabling AI-powered voice conversations with access to backend tools via MCP (Model Context Protocol).

### Architecture

```
[PSTN/Caller]
    ↕ SIP/RTP
[Twilio Number → Media Streams]
    ↕ Webhook + WebSocket
[Voice Agent Server]
    ├─ HTTP: /twilio/answer (TwiML)
    ├─ WS: /ws/twilio (Twilio media stream)
    ├─ OpenAI Realtime WebSocket
    ├─ MCP server (ws://localhost:9797)
    │   └─ Supabase tools
    └─ Supabase Edge Function (call events)
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Twilio account with phone number
- OpenAI API key with Realtime API access
- Supabase project
- Cloudflare account (for tunnel)

### Local Development

1. **Install dependencies:**
   ```bash
   cd apps/voice-agent
   pnpm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Start the server:**
   ```bash
   pnpm dev
   ```

4. **Test health endpoint:**
   ```bash
   curl http://localhost:8787/health
   ```

### Docker + Cloudflare Tunnel

1. **Setup Cloudflare Tunnel:**
   - Create tunnel at https://one.dash.cloudflare.com
   - Copy tunnel token to `.env` as `CLOUDFLARE_TUNNEL_TOKEN`
   - Configure tunnel to point to `http://voice-agent:8787`

2. **Start with Docker Compose:**
   ```bash
   cd apps/voice-agent
   docker compose up --build
   ```

3. **Get public URL:**
   - Check cloudflared logs for your public hostname
   - Update `PUBLIC_WS_URL` in `.env` with: `wss://YOUR_HOSTNAME/ws/twilio`

4. **Configure Twilio:**
   - Go to Twilio Console → Phone Numbers
   - Select your number
   - Under "Voice Configuration":
     - "A Call Comes In" → Webhook → `https://YOUR_HOSTNAME/twilio/answer`
     - Method: POST

## Configuration

### Environment Variables

Required variables:

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
OPENAI_REALTIME_VOICE=verse

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Public URLs
PUBLIC_WS_URL=wss://your-tunnel-host/ws/twilio
```

### Feature Flags

```bash
VOICE_AGENT_ENABLED=true           # Master switch
VOICE_AGENT_DUPLEX_ENABLED=false   # Full duplex audio (TODO)
VOICE_AGENT_MCP_ENABLED=true       # Enable MCP tools
VOICE_AGENT_STORAGE_ENABLED=true   # Store call events
```

## Database Setup

### Create calls table

Run this migration in Supabase:

```sql
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  from_number text not null,
  to_number text not null,
  call_sid text,
  transcript text,
  intent text,
  duration integer,
  status text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Add indexes for common queries
create index idx_calls_from_number on calls(from_number);
create index idx_calls_to_number on calls(to_number);
create index idx_calls_call_sid on calls(call_sid);
create index idx_calls_created_at on calls(created_at desc);
```

### Deploy Edge Function

```bash
# From repository root
supabase functions deploy call-webhook --no-verify-jwt
```

## API Endpoints

### Health Check
- **GET** `/health`
- Returns: `{ ok: true, version: "0.1.0", uptime: 123 }`

### Readiness Check
- **GET** `/ready`
- Returns: `{ ready: true }` or `503` if missing config

### Twilio Answer Webhook
- **POST** `/twilio/answer`
- Returns: TwiML XML with `<Connect><Stream>` instruction

### Twilio Media Stream
- **WS** `/ws/twilio`
- Accepts Twilio Media Stream JSON messages

## MCP Tools

The MCP server exposes tools that the Realtime API can call:

### get_member_balance

Get a member's balance from Supabase.

**Request:**
```json
{
  "id": "req_123",
  "method": "tool.call",
  "params": {
    "name": "get_member_balance",
    "args": { "memberId": "member_123" }
  }
}
```

**Response:**
```json
{
  "id": "req_123",
  "result": {
    "success": true,
    "memberId": "member_123",
    "balance": 1500,
    "currency": "RWF"
  }
}
```

### redeem_voucher

Redeem a voucher code.

**Request:**
```json
{
  "id": "req_124",
  "method": "tool.call",
  "params": {
    "name": "redeem_voucher",
    "args": { 
      "code": "SAVE50",
      "memberId": "member_123"
    }
  }
}
```

**Response:**
```json
{
  "id": "req_124",
  "result": {
    "success": true,
    "code": "SAVE50",
    "value": 5000,
    "currency": "RWF"
  }
}
```

## Testing

### Unit Tests

```bash
pnpm test
```

Tests include:
- Audio transcoding stubs
- MCP tool validation
- Realtime session creation

### Manual E2E Test

1. Start server (dev or Docker)
2. Call your Twilio number
3. Verify:
   - Greeting plays
   - Voice recognition works
   - Responses are natural
   - Call event stored in Supabase

### Test with curl

```bash
# Health check
curl http://localhost:8787/health

# Twilio answer endpoint
curl -X POST http://localhost:8787/twilio/answer \
  -d "From=+1234567890&To=+0987654321"
```

## Known Limitations

### MVP Constraints

1. **Audio Transcoding**: Currently using stub implementation
   - μ-law → PCM16 conversion is pass-through
   - No 8kHz → 16kHz resampling
   - Production needs proper DSP library

2. **No Audio Output**: One-way audio only (caller → AI)
   - Realtime API audio responses not sent back to caller
   - Full duplex requires additional implementation

3. **No Barge-in**: Caller cannot interrupt AI during speech

### Planned Improvements (Phase 2)

- [ ] Proper μ-law/PCM16 transcoding with resampling
- [ ] Full duplex audio (AI responses → caller)
- [ ] Barge-in detection and handling
- [ ] Backpressure control
- [ ] Twilio signature verification
- [ ] Rate limiting and circuit breakers

## Troubleshooting

### 400 Bad Request from Twilio

**Symptom**: Twilio logs show 400 errors when calling webhook

**Solutions**:
- Verify `PUBLIC_WS_URL` is set correctly in env
- Check Twilio webhook URL is HTTPS
- Ensure server is reachable from internet

### WebSocket Closes Immediately

**Symptom**: Connection closes right after opening

**Solutions**:
- Check OPENAI_API_KEY is valid
- Verify Realtime API access on your account
- Check logs for error messages

### No Audio Recognition

**Symptom**: Call connects but AI doesn't respond

**Solutions**:
- Check Realtime API is receiving audio data (logs)
- Verify audio format is correct
- Test with known working audio samples

### Database Errors

**Symptom**: Call events not being stored

**Solutions**:
- Verify `calls` table exists in Supabase
- Check SUPABASE_SERVICE_ROLE_KEY has write access
- Review Edge Function logs in Supabase dashboard

### Cloudflare Tunnel Not Working

**Symptom**: Cannot reach public URL

**Solutions**:
- Verify CLOUDFLARE_TUNNEL_TOKEN is correct
- Check tunnel status in Cloudflare dashboard
- Ensure voice-agent service is healthy

## Security

### Production Checklist

- [ ] Enable Twilio request signature verification
- [ ] Use environment variables for all secrets (never commit)
- [ ] Restrict MCP tools to safe, idempotent operations
- [ ] Implement rate limiting on endpoints
- [ ] Add authentication for MCP server
- [ ] Review and restrict Supabase RLS policies
- [ ] Enable HTTPS only in production
- [ ] Monitor and alert on unusual activity
- [ ] Rotate API keys regularly

### Secrets Management

- **Development**: Use `.env` file (git-ignored)
- **Production**: Use platform secrets (Docker secrets, K8s secrets, etc.)
- **Never log**: API keys, tokens, or sensitive user data

## Monitoring

### Structured Logs

All logs are JSON with standard fields:
```json
{
  "ts": "2024-01-15T10:30:00.000Z",
  "msg": "Twilio stream started",
  "sessionId": "session_123",
  "callSid": "CA123abc"
}
```

### Key Metrics to Track

- Call volume and duration
- Realtime API latency and errors
- WebSocket connection stability
- Tool call success/failure rates
- Audio quality (when implemented)

### Health Checks

- **/health**: Liveness check (returns 200 if running)
- **/ready**: Readiness check (validates configuration)

## Rollout Plan

### Phase 1: Internal Testing (MVP)

1. Deploy behind feature flag (`VOICE_AGENT_ENABLED=false`)
2. Configure test Twilio number
3. Dogfood with internal team
4. Monitor logs and fix issues

### Phase 2: Production Hardening

1. Implement proper audio transcoding
2. Add full duplex audio
3. Enable barge-in
4. Add comprehensive monitoring
5. Load testing with realistic scenarios

### Phase 3: Gradual Rollout

1. Enable for subset of users
2. Monitor metrics and feedback
3. Adjust AI instructions per use case
4. Scale infrastructure as needed

## Support

For issues or questions:
- Check logs: `docker compose logs -f voice-agent`
- Review Supabase Edge Function logs
- Check Twilio console for call logs
- Verify environment configuration

## License

Same as parent ICUPA project.
