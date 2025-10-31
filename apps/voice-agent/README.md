# ICUPA Voice Agent

Production-ready voice agent connecting Twilio (SIP/Media Streams) to OpenAI Realtime API with MCP tools.

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Development
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Production with Docker
docker compose up --build
```

## Documentation

See [docs/voice-agent.md](../../docs/voice-agent.md) for complete documentation including:

- Architecture overview
- Configuration guide
- Twilio setup
- Database schema
- MCP tools
- Testing
- Troubleshooting
- Security considerations

## Features

### MVP (Current)

- ✅ Inbound call handling via Twilio Media Streams
- ✅ WebSocket bridge: Twilio ⇄ OpenAI Realtime
- ✅ MCP tool server with Supabase integration
  - `get_member_balance` - Query member savings
  - `redeem_voucher` - Redeem voucher codes
- ✅ Supabase Edge Function for call event storage
- ✅ Docker + Cloudflare Tunnel support
- ✅ Structured logging and health checks
- ✅ Feature flags for gradual rollout

### Planned (Phase 2)

- [ ] Proper μ-law ↔ PCM16 transcoding with resampling
- [ ] Full duplex audio (AI responses → caller)
- [ ] Barge-in support
- [ ] Backpressure control
- [ ] Twilio signature verification
- [ ] Enhanced monitoring and metrics

## Environment Variables

Required:

- `OPENAI_API_KEY` - OpenAI API key with Realtime access
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_FROM_NUMBER` - Your Twilio phone number
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `PUBLIC_WS_URL` - Public WebSocket URL for Twilio

Optional:

- `PORT` - HTTP server port (default: 8787)
- `MCP_PORT` - MCP server port (default: 9797)
- `VOICE_AGENT_ENABLED` - Enable/disable voice agent (default: true)
- `VOICE_AGENT_MCP_ENABLED` - Enable/disable MCP tools (default: true)

## Architecture

```
[Caller] → [Twilio] → [WebSocket] → [Voice Agent] → [OpenAI Realtime]
                                           ↓
                                      [MCP Server]
                                           ↓
                                      [Supabase]
```

## Development

### Run locally

```bash
pnpm dev
```

Server will start on http://localhost:8787

### Test endpoints

```bash
# Health check
curl http://localhost:8787/health

# Readiness check
curl http://localhost:8787/ready
```

### Run with Cloudflare Tunnel

```bash
# Set CLOUDFLARE_TUNNEL_TOKEN in .env
docker compose up
```

## Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test:watch
```

## Database Setup

The voice agent stores call events in a `calls` table. Run this migration:

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

create index idx_calls_from_number on calls(from_number);
create index idx_calls_to_number on calls(to_number);
create index idx_calls_call_sid on calls(call_sid);
create index idx_calls_created_at on calls(created_at desc);
```

## License

Same as parent ICUPA project.
