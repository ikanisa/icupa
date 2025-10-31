# OpenAI Agents SDK Integration - ICUPA

This directory contains the OpenAI Agents SDK integration for ICUPA, following the blueprint and best practices for building multi-agent, multi-modal applications.

## Overview

ICUPA uses the OpenAI Agents SDK to power AI-driven features including:
- **AI Waiter**: Conversational assistant for menu browsing and ordering
- **Booking Agent**: Handles reservations for bar truck and venue slots
- **Allergen Guardian**: Safety-focused agent for dietary restrictions
- **Upsell Agent**: Context-aware recommendations and pairings
- **Inventory Agent**: Stock management and 86 decisions
- **Support Agent**: Customer service ticket handling
- **Compliance Agent**: Regulatory task management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (PWA)                         │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  Client UI     │  │  Merchant UI   │  │   Admin UI   │  │
│  │  (Vite/React)  │  │  (Vite/React)  │  │ (Vite/React) │  │
│  └────────┬───────┘  └────────┬───────┘  └──────┬───────┘  │
└───────────┼──────────────────┼──────────────────┼──────────┘
            │                  │                  │
            └──────────────────┴──────────────────┘
                               │
                               ▼
            ┌──────────────────────────────────────┐
            │     Agents Service (Fastify)         │
            │  Port: 8787                          │
            │  ┌────────────────────────────────┐  │
            │  │  Agent Orchestration Layer     │  │
            │  │  - Route requests to agents    │  │
            │  │  - Apply guardrails & policies │  │
            │  │  - Track costs & metrics       │  │
            │  └──────────────┬─────────────────┘  │
            │                 │                     │
            │  ┌──────────────▼─────────────────┐  │
            │  │   OpenAI Agents SDK            │  │
            │  │   (@openai/agents v0.2.1)     │  │
            │  │                                │  │
            │  │  ┌──────────────────────────┐  │  │
            │  │  │  Agent Definitions       │  │  │
            │  │  │  - Waiter                │  │  │
            │  │  │  - Booking               │  │  │
            │  │  │  - Allergen Guardian     │  │  │
            │  │  │  - Upsell                │  │  │
            │  │  └──────────────────────────┘  │  │
            │  │                                │  │
            │  │  ┌──────────────────────────┐  │  │
            │  │  │  Tools                   │  │  │
            │  │  │  - Menu search           │  │  │
            │  │  │  - Allergen check        │  │  │
            │  │  │  - Cart operations       │  │  │
            │  │  │  - Booking management    │  │  │
            │  │  └──────────────────────────┘  │  │
            │  └────────────────────────────────┘  │
            └──────────────────┬───────────────────┘
                               │
                               ▼
            ┌──────────────────────────────────────┐
            │         Supabase Backend             │
            │  ┌────────────────────────────────┐  │
            │  │  Database (PostgreSQL)         │  │
            │  │  - menu_items                  │  │
            │  │  - bookings                    │  │
            │  │  - agent_sessions              │  │
            │  │  - agent_events                │  │
            │  └────────────────────────────────┘  │
            │  ┌────────────────────────────────┐  │
            │  │  Storage                       │  │
            │  │  - Images, documents           │  │
            │  └────────────────────────────────┘  │
            │  ┌────────────────────────────────┐  │
            │  │  Edge Functions                │  │
            │  │  - Additional API endpoints    │  │
            │  └────────────────────────────────┘  │
            └──────────────────────────────────────┘
```

## Directory Structure

```
libs/
├── agents/                    # Agent definitions
│   └── bookingAgent.ts       # Example: Booking agent with tools
├── db/                       # Database client wrappers
│   └── supabaseClient.ts     # Supabase client for agents
├── types/                    # Shared TypeScript types
│   └── agents.ts             # Agent context and result types
└── README.md                 # This file

agents-service/               # Main agents service (existing)
├── src/
│   ├── agents/              # Production agent implementations
│   │   └── agents.ts        # Waiter, Upsell, Guardian, etc.
│   ├── tools/               # Tool implementations
│   ├── middleware/          # Policy enforcement
│   └── server.ts            # Fastify server
└── package.json
```

## Key Features

### 🤖 Multi-Agent Orchestration

The system uses multiple specialized agents that can hand off to each other:

- **Primary Agent (Waiter)**: Main conversational interface
- **Safety Agent (Allergen Guardian)**: Validates responses for safety
- **Enhancement Agent (Upsell)**: Provides contextual recommendations

### 🛡️ Guardrails & Safety

- **Input validation**: Zod schemas for all tool parameters
- **Budget limits**: Token usage caps per session/day
- **Rate limiting**: Requests per session/user
- **Tool depth limits**: Prevent infinite tool call loops
- **Content filtering**: OpenAI moderation + custom policies

### 📊 Observability

- **OpenTelemetry**: Distributed tracing with spans
- **Structured logging**: JSON logs with correlation IDs
- **Event auditing**: All agent interactions stored in database
- **Cost tracking**: Token usage and estimated costs per request

### 🔐 Security

- **Session validation**: Supabase auth integration
- **Multi-tenancy**: Tenant isolation in all queries
- **PII scrubbing**: Sensitive data never logged
- **Service role isolation**: Backend client only on server

## Getting Started

### Prerequisites

- Node.js 18.18.2+ (or 20.x)
- pnpm 10.x
- Supabase project with configured tables
- OpenAI API key

### Environment Setup

1. **Copy environment files**:
   ```bash
   cp .env.example .env.local
   cp agents-service/.env.example agents-service/.env
   ```

2. **Configure Supabase** (`.env.local`):
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. **Configure Agents Service** (`agents-service/.env`):
   ```bash
   OPENAI_API_KEY=sk-...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   AGENTS_PORT=8787
   ```

### Running the Service

```bash
# Install dependencies
pnpm install

# Start Supabase locally (optional)
pnpm supabase:start
pnpm supabase:reset

# Start agents service
pnpm dev:agents

# Or start all services
pnpm dev:all
```

The agents service will be available at `http://localhost:8787`.

## Creating a New Agent

Follow this pattern from `libs/agents/bookingAgent.ts`:

```typescript
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';

// 1. Define your tools
const myTool = tool({
  name: 'my_tool',
  description: 'What this tool does',
  parameters: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async (input) => {
    // Tool implementation
    return { result: 'data' };
  },
});

// 2. Define output schema
const OutputSchema = z.object({
  reply: z.string(),
  data: z.array(z.string()).optional(),
});

// 3. Define agent context type
interface MyAgentContext {
  userId?: string;
  tenantId?: string;
  // ... other context fields
}

// 4. Create the agent
export const MyAgent = new Agent<MyAgentContext, typeof OutputSchema>({
  name: 'My Agent',
  instructions: async (runContext) => {
    const context = runContext.context;
    return `You are a helpful assistant...`;
  },
  handoffDescription: 'What this agent does',
  model: 'gpt-4o',
  tools: [myTool],
  outputType: OutputSchema,
});
```

## Using the Agents Service API

### Example: Waiter Agent

```bash
curl -X POST http://localhost:8787/agents/waiter \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What vegetarian options do you have?",
    "tenant_id": "tenant-123",
    "location_id": "loc-456",
    "allergies": ["peanuts"],
    "cart": []
  }'
```

Response:
```json
{
  "session_id": "sess-abc123",
  "reply": "We have several delicious vegetarian options...",
  "upsell": [
    {
      "name": "Garden Salad",
      "price_cents": 1200,
      "currency": "RWF"
    }
  ],
  "disclaimers": [],
  "citations": ["menu:veg-001"],
  "cost_usd": 0.0234,
  "metadata": {
    "model": "gpt-4o",
    "usage": {
      "inputTokens": 450,
      "outputTokens": 120
    }
  }
}
```

### Example: Booking Agent

Integration point for the booking agent (to be added to agents-service):

```typescript
import { BookingAgent } from '../../libs/agents/bookingAgent';
import { runner } from './agents';

app.post('/agents/booking', async (request, reply) => {
  const { message, tenant_id, user_id } = request.body;
  
  const context = {
    tenantId: tenant_id,
    userId: user_id,
    language: 'English',
    region: 'Rwanda',
  };
  
  const result = await runner.run(BookingAgent, message, { context });
  
  return reply.send({
    session_id: result.sessionId,
    output: result.finalOutput,
  });
});
```

## Best Practices

### 1. **Agent Design**

- Keep agents focused on specific domains (booking, menu, support)
- Use hand-offs to delegate to specialized agents
- Always validate inputs with Zod schemas
- Include clear instructions and examples in agent prompts

### 2. **Tool Development**

- Make tools idempotent when possible
- Include comprehensive error handling
- Log tool executions for debugging
- Document expected inputs and outputs

### 3. **Context Management**

- Keep context minimal - only include what's needed
- Use type-safe context interfaces
- Pass sensitive data through secure channels
- Avoid storing PII in context

### 4. **Cost Management**

- Use appropriate models (gpt-4o vs gpt-4o-mini)
- Implement token budget limits
- Cache frequently used data
- Monitor cost per session/user

### 5. **Safety & Guardrails**

- Always validate allergen information from database
- Never guess or infer safety-critical information
- Implement kill switches for emergency disabling
- Log all safety-relevant decisions

## Integration with Existing Code

The `libs/` directory complements the existing `agents-service/` implementation:

- **`agents-service/src/agents/agents.ts`**: Production agents (Waiter, Guardian, etc.)
- **`libs/agents/`**: Example agents and patterns
- **`agents-service/src/tools/`**: Production tools
- **`libs/db/`**: Reusable database clients
- **`libs/types/`**: Shared type definitions

Use the patterns in `libs/` as templates when creating new agents in `agents-service/`.

## Troubleshooting

### Agent Times Out

- Check `AGENT_TIMEOUT_MS` environment variable (default 45s)
- Reduce complexity of tool operations
- Use streaming for long-running operations

### High Costs

- Switch to gpt-4o-mini for non-critical agents
- Implement aggressive caching
- Reduce context size
- Set budget limits per session

### Tool Failures

- Check Supabase connection and credentials
- Verify RLS policies allow service role access
- Review tool parameter validation
- Check OpenTelemetry traces for details

## References

- [OpenAI Agents SDK Documentation](https://platform.openai.com/docs/agents)
- [Agents Service README](../agents-service/README.md)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenTelemetry](https://opentelemetry.io)

## Contributing

When adding new agents or tools:

1. Create agent in `libs/agents/` for prototyping
2. Add comprehensive tests
3. Move to `agents-service/src/agents/` for production
4. Update this documentation
5. Configure guardrails in middleware

## License

Proprietary - © 2025 ICUPA
