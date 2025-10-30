# AI Agents Infrastructure

This directory contains the AI agent infrastructure for ICUPA, implementing OpenAI Responses API (text tools), Realtime API (SIP voice), integrated with Supabase voucher backend and WhatsApp Cloud API.

## Architecture

```
/ai
  /schemas          - Zod schemas + JSON Schema for tools & payloads
  /responses        - OpenAI Responses API client and router
  /realtime         - SIP session handler and tool bridge
  /agentkit         - AgentKit config (graph, connectors, evals)
  /evals            - Golden conversations + graders
  /tooling          - Tool calling adapter

/apps/api
  /whatsapp         - WhatsApp webhook handler and sender
  /openai           - Realtime webhook handler
  health.ts         - Health check endpoint

/apps/supabase/functions
  lookup_customer   - Find customer by MSISDN
  create_voucher    - Create and persist voucher
  redeem_voucher    - Redeem issued voucher
  void_voucher      - Void issued voucher

/config
  otel.ts           - OpenTelemetry tracing
  logging.ts        - Structured logging with PII redaction
  featureFlags.ts   - Feature flag configuration
```

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_RESPONSES_MODEL=gpt-4.1-mini
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# WhatsApp Cloud API
WA_PHONE_NUMBER_ID=123456789
WA_ACCESS_TOKEN=EAAB...
WA_VERIFY_TOKEN=your-random-token
WA_API_BASE=https://graph.facebook.com/v19.0

# Optional: SIP/Telephony
SIP_TRUNK_URI=sip:trunk@provider.com
SIP_AUTH_USER=user
SIP_AUTH_PASS=pass

# Optional: Observability
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector
OTEL_SERVICE_NAME=ai-agents
LOG_LEVEL=info
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Database Setup

Ensure your Supabase database has the required tables:

```sql
-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msisdn TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vouchers table
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_msisdn TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'RWF',
  status TEXT CHECK (status IN ('issued', 'redeemed', 'void')) DEFAULT 'issued',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_customers_msisdn ON customers(msisdn);
CREATE INDEX idx_vouchers_customer ON vouchers(customer_msisdn);
CREATE INDEX idx_vouchers_status ON vouchers(status);
```

## Usage

### WhatsApp Integration

1. **Set up webhook** in Meta Developer Console:
   - Webhook URL: `https://your-domain.com/api/whatsapp/webhook`
   - Verify token: Set in `WA_VERIFY_TOKEN`
   - Subscribe to `messages` webhook field

2. **Send test message** to your WhatsApp Business number:
   ```
   User: Hi, create a voucher for 5000 RWF for +250788123456
   Bot: I've created a voucher for 5000 RWF. The voucher ID is abc-123-def.
   ```

### Voice/Realtime Integration

1. **Start SIP session**:
   ```typescript
   import { startSipSession } from './ai/realtime/sipSession';
   
   const { sdpAnswer } = await startSipSession(
     sdpOffer,
     "You are a voice voucher agent",
     toolSpecs
   );
   ```

2. **Handle tool callbacks**:
   ```typescript
   import { handleRealtimeWebhook } from './apps/api/openai/realtimeWebhook';
   
   const result = await handleRealtimeWebhook(event);
   ```

### Direct API Usage

```typescript
import { respond, extractTextResponse } from './ai/responses/router';

const input = [
  { role: 'system', content: 'You are a voucher agent' },
  { role: 'user', content: 'Create voucher for 5000 RWF' }
];

const response = await respond(input);
const text = extractTextResponse(response);
```

## Testing

### Unit Tests

```bash
pnpm test
```

### Evals

```bash
# Run evaluations
pnpm tsx scripts/evals/eval-ci.ts

# Or use npm script (add to package.json):
pnpm run eval
```

Eval pass threshold: 95%
- Tool args accuracy: 40% weight
- Hallucination detection: 30% weight
- PII leak detection: 30% weight

## Tools

The system provides four main tools:

1. **lookup_customer** - Find customer by MSISDN
   ```json
   {
     "msisdn": "+250788123456"
   }
   ```

2. **create_voucher** - Create new voucher
   ```json
   {
     "customer_msisdn": "+250788123456",
     "amount": 5000,
     "currency": "RWF"
   }
   ```

3. **redeem_voucher** - Redeem issued voucher
   ```json
   {
     "voucher_id": "abc-123-def"
   }
   ```

4. **void_voucher** - Void issued voucher
   ```json
   {
     "voucher_id": "abc-123-def"
   }
   ```

## Security

- **No secrets in repo**: All secrets in environment variables
- **PII redaction**: Phone numbers and sensitive data masked in logs
- **Idempotency**: WhatsApp messages deduplicated by message ID
- **Rate limiting**: Implement per-tenant limits (TODO)
- **Input validation**: All inputs validated with Zod schemas

## Observability

### Logging

Structured JSON logs with PII redaction:

```typescript
import { createLogger } from './config/logging';

const logger = createLogger('my-module');
logger.info('Processing message', { messageId: '123' });
```

### Tracing

OpenTelemetry tracing (if enabled):

```typescript
import { startOTel } from './config/otel';

startOTel(); // Call once at startup
```

### Health Check

```bash
curl https://your-domain.com/api/health
```

Response:
```json
{
  "ok": true,
  "timestamp": "2025-10-30T06:00:00.000Z",
  "service": "ai-agents",
  "version": "0.1.0",
  "checks": {
    "database": true,
    "openai": true,
    "whatsapp": true
  }
}
```

## Feature Flags

Control feature rollout via environment variables:

```bash
AI_REALTIME_ENABLED=true
AI_RESPONSES_ENABLED=true
WHATSAPP_INTEGRATION_ENABLED=true
VOUCHER_CREATION_ENABLED=true
VOUCHER_REDEMPTION_ENABLED=true
TELEMETRY_ENABLED=false
DEBUG_LOGGING_ENABLED=false
```

## Troubleshooting

### WhatsApp webhook not receiving messages

1. Check webhook is verified: `hub.verify_token` matches `WA_VERIFY_TOKEN`
2. Check webhook URL is publicly accessible
3. Check webhook is subscribed to `messages` field
4. Check logs for incoming requests

### Voice session fails to start

1. Check `OPENAI_API_KEY` is set
2. Check SDP offer is valid
3. Check Realtime API model is correct
4. Check network connectivity to OpenAI

### Tool calls failing

1. Check Supabase credentials are correct
2. Check database tables exist
3. Check tool arguments match schema
4. Check logs for error messages

## Performance

- Tool call timeout: 3s budget
- Voice E2E latency: target p95 < 800ms
- Trace tool latency: target p95 < 2.5s

## Support

See [migration.md](./migration.md) for rollback instructions.
See [runbooks.md](./runbooks.md) for operational procedures.
