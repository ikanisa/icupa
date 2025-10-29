# ICUPA Agents Service

The ICUPA Agents Service is a Fastify-based backend service that provides AI-powered conversational agents for the ICUPA platform, including the AI Waiter, Allergen Guardian, and Upsell agents.

## Overview

- **Framework**: Fastify (high-performance Node.js web framework)
- **AI Provider**: OpenAI Agents SDK with GPT-4
- **Language**: TypeScript
- **Runtime**: Node.js 18.18.2+
- **Port**: 8787 (configurable via `AGENTS_PORT`)

## Features

- 🤖 Multi-agent orchestration with OpenAI Agents SDK
- 🛡️ Safety guardrails and policy enforcement
- 📊 OpenTelemetry observability and tracing
- 🔐 Supabase session validation
- 📝 Structured logging (JSON format)
- 💾 Event auditing to `agent_events` table
- 🎙️ WebRTC token generation for voice waiter
- ⚡ Tool-based architecture with Zod validation

## Architecture

```
agents-service/
├── src/
│   ├── server.ts           # Fastify app entry point
│   ├── config/             # Configuration and environment
│   ├── middleware/         # Policy enforcement, auth, logging
│   ├── agents/             # Agent definitions (waiter, guardian, upsell)
│   ├── tools/              # Tool implementations with Zod schemas
│   ├── telemetry/          # OpenTelemetry setup
│   └── services/           # External service integrations
├── Dockerfile              # Multi-stage Docker build
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18.18.2 or later
- pnpm 10.x
- Supabase project with configured tables
- OpenAI API key

### Environment Variables

Create a `.env` file in the `agents-service` directory:

```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Optional
AGENTS_HOST=0.0.0.0
AGENTS_PORT=8787
OTEL_SERVICE_NAME=icupa-agents-service
OTEL_EXPORTER_OTLP_ENDPOINT=...
```

### Development

```bash
# Install dependencies (from repo root)
pnpm install

# Run in development mode
pnpm --filter agents-service dev

# Or from this directory
cd agents-service
pnpm dev
```

### Production Build

```bash
# Build TypeScript
pnpm build

# Start production server
pnpm start
```

### Docker

```bash
# Build image
docker build -t icupa-agents-service:latest -f agents-service/Dockerfile .

# Run container
docker run -p 8787:8787 \
  -e OPENAI_API_KEY=... \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  icupa-agents-service:latest
```

## API Endpoints

### Health Check

```bash
GET /health
```

Returns service health status.

### AI Waiter

```bash
POST /agents/waiter
Content-Type: application/json

{
  "message": "What vegetarian options do you have?",
  "session_id": "...",
  "context": {
    "table_id": "T001",
    "menu_id": "menu_123"
  }
}
```

Orchestrates the AI waiter agent with allergen guardian and upsell agents.

### Agent Feedback

```bash
POST /agent-feedback
Content-Type: application/json

{
  "event_id": "evt_123",
  "feedback": "positive" | "negative",
  "comment": "Helpful suggestion"
}
```

Records user feedback on agent responses.

### Tool Endpoints

```bash
POST /tools/menu/search
POST /tools/allergen/check
POST /tools/cart/add
```

Tool endpoints called by agents during execution.

### Realtime Token

```bash
GET /realtime/token?session_id=...
```

Issues short-lived WebRTC tokens for voice waiter integration.

## Agent Architecture

### Waiter Agent

The primary conversational agent that:
- Answers menu questions
- Provides recommendations
- Handles dietary restrictions
- Assists with ordering

**Capabilities:**
- Menu search and filtering
- Allergen information (via guardian)
- Price transparency
- Upsell suggestions (via upsell agent)

### Allergen Guardian

A safety-focused agent that:
- Blocks responses containing allergens user is allergic to
- Validates ingredient safety
- Provides clear allergen warnings
- Never guesses or assumes allergen information

**Safety Rules:**
- Always check menu data, never infer
- Escalate to human if uncertain
- Log all allergen checks for audit

### Upsell Agent

An optional agent that:
- Suggests complementary items
- Highlights popular dishes
- Respects user preferences
- Never pushes alcohol to minors (age-gated)

**Business Rules:**
- Only suggest items from current menu
- Respect dietary restrictions
- Limit to 2-3 suggestions per conversation
- Honor kill switches and feature flags

## Middleware & Policies

### Policy Enforcement

- **Budget limits**: Token usage caps per session
- **Rate limiting**: Requests per session/user
- **Tool depth**: Prevent infinite tool call loops
- **Feature flags**: Enable/disable features dynamically

### Authentication

All requests must include valid Supabase session:

```javascript
{
  "x-icupa-session": "base64(supabase-jwt)"
}
```

Session is validated against Supabase Auth before processing.

### Logging & Telemetry

- **Structured logs**: JSON format with correlation IDs
- **OpenTelemetry spans**: Distributed tracing
- **Event auditing**: All agent interactions logged to DB
- **PII scrubbing**: Sensitive data never logged

## Tools

Tools are the building blocks agents use to interact with the system:

### Menu Tools

- `menu.search` - Search menu items by query
- `menu.get_item` - Get full item details
- `menu.list_categories` - List menu categories

### Allergen Tools

- `allergen.check` - Check if item contains allergens
- `allergen.list` - List all allergens in item

### Cart Tools

- `cart.add` - Add item to cart
- `cart.get` - Get current cart
- `cart.update` - Update cart quantities

All tools use Zod schemas for validation and have comprehensive error handling.

## Configuration

### Feature Flags

Controlled via `agent_runtime_configs` table:

- `ai.waiter.enabled` - Enable/disable AI waiter
- `ai.waiter.voice.enabled` - Enable voice interaction
- `ai.upsell.enabled` - Enable upsell suggestions
- `ai.guardrails.strict` - Strict safety mode

### Kill Switches

Emergency toggles to disable features instantly:

```bash
# Disable all AI features
curl -X POST /api/kill-switch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"feature": "ai.all", "enabled": false}'
```

## Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test --coverage

# Test specific file
pnpm test agents/waiter.test.ts
```

## Monitoring

### Metrics

- Request rate
- Response latency (P50, P95, P99)
- Error rate
- Token usage
- Agent execution time

### Alerts

- High error rate (>5%)
- Slow responses (>5s P95)
- OpenAI API failures
- Budget exhaustion

### Logs

View logs in production:

```bash
# Cloud Run
gcloud logging read "resource.type=cloud_run_revision" --limit 100

# Docker
docker logs <container-id>
```

## Troubleshooting

### Common Issues

**Problem**: `OPENAI_API_KEY not found`
```bash
# Solution: Set environment variable
export OPENAI_API_KEY=sk-...
```

**Problem**: `Supabase connection failed`
```bash
# Solution: Check URL and key
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

**Problem**: `Tool execution timeout`
```bash
# Solution: Check tool depth limits and increase timeout
# Edit middleware/policy.ts
```

## Performance

Expected performance (P95):

- Agent response: < 5s
- Tool execution: < 1s
- Token generation: < 100ms

Optimize by:
- Caching menu embeddings
- Parallelizing tool calls
- Using streaming responses

## Security

- ✅ Non-root Docker user
- ✅ Session validation
- ✅ Input sanitization (Zod)
- ✅ Rate limiting
- ✅ PII scrubbing
- ✅ OpenAI content filters
- ✅ Health checks

## Contributing

When adding new agents or tools:

1. Define agent in `agents/`
2. Implement tools in `tools/` with Zod schemas
3. Add tests
4. Update documentation
5. Configure guardrails in `middleware/policy.ts`

## References

- [OpenAI Agents SDK](https://platform.openai.com/docs/agents)
- [Fastify Documentation](https://fastify.dev)
- [OpenTelemetry](https://opentelemetry.io)
- [Architecture Docs](../docs/ARCHITECTURE.md)
- [Backend Contract](../docs/backend-contract.md)

## License

Proprietary - © 2025 ICUPA
