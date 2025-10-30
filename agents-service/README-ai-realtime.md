# OpenAI Realtime API Integration

This directory contains a single-socket OpenAI Realtime integration with event-based persona routing. It enables real-time conversational AI with hot-swappable personas ("AI Waiter" ↔ "AI CFO") over a single WebSocket connection.

## Features

- **Single WebSocket Connection**: One persistent connection to OpenAI's Realtime API
- **Persona Hot-Swapping**: Switch between personas without reconnecting
- **Built-in Tool Handlers**: Integrated Supabase queries for menu lookup, financials, and more
- **Production Ready**: Logging with pino, input validation, graceful error handling

## Quick Start

### Prerequisites

- Node 18+ (or Node 20+)
- OpenAI API key with Realtime API access
- Supabase database (for tool handlers)

### Installation

Dependencies are already installed via the workspace. To install manually:

```bash
cd agents-service
pnpm install
```

### Configuration

Copy the `.env.example` and set your OpenAI API key:

```bash
cp .env.example .env
```

Required environment variables:

```env
OPENAI_API_KEY=sk-xxx
OPENAI_REALTIME_ENDPOINT=wss://api.openai.com/v1/realtime
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-12-17
DEFAULT_PERSONA=waiter
AI_REALTIME_ENABLED=true
```

### Running

Start the development server:

```bash
pnpm dev
```

The realtime routes will be available at:
- `POST /ai/say` - Send a message to the AI
- `POST /ai/persona` - Switch between personas
- `GET /ai/healthz` - Health check

## API Usage

### Send a Message

```bash
curl -X POST http://localhost:8787/ai/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello, what menu items do you have?"}'
```

Or use the npm script:

```bash
pnpm ai:demo
```

### Switch Persona

Switch to CFO persona:

```bash
curl -X POST http://localhost:8787/ai/persona \
  -H 'Content-Type: application/json' \
  -d '{"key":"cfo"}'
```

Or use the npm scripts:

```bash
pnpm ai:persona:cfo
pnpm ai:persona:waiter
```

### Health Check

```bash
curl http://localhost:8787/ai/healthz
```

Or:

```bash
pnpm ai:health
```

## Personas

### Waiter Persona

**System Prompt**: Friendly AI waiter for restaurants in Rwanda & Malta
**Tools**:
- `lookup_menu(query)` - Search menu items by name
- `recommend_pairing(itemId)` - Suggest food/drink pairings

**Example Usage**:
```bash
curl -X POST http://localhost:8787/ai/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"What coffee drinks do you have?"}'
```

### CFO Persona

**System Prompt**: Expert AI CFO for Western markets (US/CA/EU/UK), IFRS/GAAP compliant
**Tools**:
- `fetch_financials(period)` - Get P&L summary for a period
- `check_tax_rule(jurisdiction, topic)` - Check tax rules

**Example Usage**:
```bash
# Switch to CFO
pnpm ai:persona:cfo

# Ask a financial question
curl -X POST http://localhost:8787/ai/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"Show me the P&L for August 2025"}'
```

## Architecture

```
agents-service/src/ai/realtime/
├── personas.ts         # Persona definitions (system prompts + tools)
├── realtimeClient.ts   # WebSocket client + tool handlers
└── routes.ts           # Fastify route handlers
```

### Flow

1. Client sends `POST /ai/say` with text
2. Route handler calls `RealtimeClient.say(text)`
3. Client sends `response.create` event to OpenAI
4. OpenAI streams back text deltas via `response.output_text.delta`
5. If model calls a tool, client handles via `handleToolCall()`
6. Tool output sent back to OpenAI via `tool.output`
7. Conversation continues...

## Tool Handlers

Tool handlers query Supabase tables. Current implementations:

### Waiter Tools

- **lookup_menu**: Queries `menu_items` table with name search
- **recommend_pairing**: Queries `pairings` table by item ID
- Includes fallback stub data for demo purposes

### CFO Tools

- **fetch_financials**: Returns stub P&L data (integrate with GL tables)
- **check_tax_rule**: Returns stub tax rule data (integrate with tax_rules table)

### Extending Tool Handlers

Edit `realtimeClient.ts` and add cases to `handleToolCall()`:

```typescript
case "your_tool":
  output = await this.yourToolHandler(args as YourArgs);
  break;
```

Then implement the handler method:

```typescript
private async yourToolHandler(args: YourArgs) {
  const { data, error } = await supabaseClient
    .from('your_table')
    .select('*')
    .eq('field', args.field);
  
  if (error) {
    this.log.error({ error }, "your_tool error");
    return { error: error.message };
  }
  
  return { data };
}
```

## Testing

Unit and integration tests are located in `__tests__/` directory:

```bash
cd agents-service
pnpm test
```

## Security

- ✅ OpenAI API key never logged
- ✅ Supabase service role key never logged
- ✅ Input validation with Zod schemas
- ✅ Feature flag: `AI_REALTIME_ENABLED`

## Deployment

### Docker

The existing Dockerfile in agents-service supports the realtime features:

```bash
docker build -t icupa-agents-service .
docker run -p 8787:8787 --env-file .env icupa-agents-service
```

### Production Considerations

- OpenAI Realtime API requires persistent WebSocket connections
- Not suitable for edge runtimes (Cloudflare Workers, Vercel Edge)
- Deploy on full Node.js hosts (e.g., Railway, Render, AWS ECS)
- Consider connection pooling for high traffic

## Troubleshooting

### WebSocket Connection Fails

Check:
1. `OPENAI_API_KEY` is set and valid
2. `OPENAI_REALTIME_ENDPOINT` is correct
3. Network allows WebSocket connections
4. Model name is correct (check OpenAI docs for latest)

### Tool Calls Not Working

Check:
1. Supabase client is initialized
2. Table names match your schema
3. Service role key has necessary permissions
4. Check logs for specific errors

### Persona Switch Not Working

Ensure:
1. Persona key is valid ("waiter" or "cfo")
2. WebSocket connection is established
3. Check logs for `session.update` events

## Future Enhancements

Planned features (see problem statement):

- Audio modality support (input_audio_buffer)
- Twilio Media Streams bridge
- WhatsApp voice integration
- Router tool for persona handoffs
- OpenTelemetry tracing
- Rate limiting per IP

## Support

For issues or questions:
1. Check the logs with `LOG_LEVEL=debug`
2. Review the OpenAI Realtime API docs
3. File an issue in the repository
