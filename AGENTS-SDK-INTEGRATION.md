# OpenAI Agents SDK Integration Guide for ICUPA

This document provides a comprehensive guide for integrating and using the OpenAI Agents SDK within the ICUPA application, following the blueprint for mobile-first, multi-agent, multi-modal applications.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Creating Your First Agent](#creating-your-first-agent)
5. [Integrating with Frontend](#integrating-with-frontend)
6. [Advanced Features](#advanced-features)
7. [Deployment](#deployment)
8. [Best Practices](#best-practices)

## Overview

ICUPA uses the **OpenAI Agents SDK** to power AI-driven features across the platform. The SDK is:

- ✅ **Provider-agnostic**: Supports OpenAI models and can be adapted to other backends
- ✅ **Production-ready**: Built for real-world complexity with agents, tools, hand-offs, guardrails, tracing
- ✅ **TypeScript-first**: Fully typed for type-safe development
- ✅ **Multi-agent capable**: Supports orchestration between specialized agents

### Why the Agents SDK?

Given ICUPA's mobile-first, interactive workflows and complex integrations (Supabase backend, dynamic UI, voice/real-world interface), the SDK provides:

1. **JS/TS support**: Embed agents in frontend, mobile apps, or serverless backend
2. **Tracing + evaluation**: Audit flows (important for mobile/multi-device setups)
3. **Voice + realtime**: Integrate agents into physical systems (bar truck, mobile kiosk)
4. **Modular design**: Fits ICUPA's architecture (services, micro-workflows, hand-offs)

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ICUPA Application Stack                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Frontend Layer (Vite + React 18 + TypeScript)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PWA (Mobile-First)                                       │  │
│  │  - Client Surface    (/src/components/client)            │  │
│  │  - Merchant Surface  (/src/components/merchant)          │  │
│  │  - Admin Surface     (/src/components/admin)             │  │
│  │                                                           │  │
│  │  UI Components:                                           │  │
│  │  - Radix UI primitives                                    │  │
│  │  - Tailwind CSS + custom theme                           │  │
│  │  - Liquid glass effects, gradients, 3D elements          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API Client Layer (libs/db/supabaseClient.ts)            │  │
│  │  - Frontend Supabase client (RLS-enabled)                │  │
│  │  - API request helpers                                    │  │
│  │  - WebSocket connections for realtime                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Backend Layer (Fastify + TypeScript)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Agents Service (Port 8787)                               │  │
│  │  Location: /agents-service                                │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Agent Orchestration                                 │ │  │
│  │  │  - Request routing                                   │ │  │
│  │  │  - Policy enforcement (budget, rate limits)          │ │  │
│  │  │  - Session management                                │ │  │
│  │  │  - Cost tracking                                     │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  OpenAI Agents SDK (@openai/agents v0.2.1)          │ │  │
│  │  │                                                       │ │  │
│  │  │  Production Agents:                                  │ │  │
│  │  │  - Waiter Agent      (menu, ordering)                │ │  │
│  │  │  - Allergen Guardian (safety checks)                 │ │  │
│  │  │  - Upsell Agent      (recommendations)               │ │  │
│  │  │  - Inventory Agent   (stock management)              │ │  │
│  │  │  - Support Agent     (customer service)              │ │  │
│  │  │  - Compliance Agent  (regulatory tasks)              │ │  │
│  │  │                                                       │ │  │
│  │  │  Example Agents (libs/agents/):                      │ │  │
│  │  │  - Booking Agent     (reservations)                  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │  Tools                                               │ │  │
│  │  │  - Menu search/filter                                │ │  │
│  │  │  - Allergen checking                                 │ │  │
│  │  │  - Cart operations                                   │ │  │
│  │  │  - Booking management                                │ │  │
│  │  │  - Inventory queries                                 │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Data Layer (Supabase)                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                      │  │
│  │  - menu_items, bookings, orders                          │  │
│  │  - agent_sessions, agent_events                          │  │
│  │  - profiles, tenants, locations                          │  │
│  │  - agent_runtime_configs (feature flags)                 │  │
│  │                                                           │  │
│  │  Storage                                                  │  │
│  │  - Images, documents, audio files                        │  │
│  │                                                           │  │
│  │  Edge Functions                                           │  │
│  │  - Supabase-native serverless functions                  │  │
│  │                                                           │  │
│  │  Auth                                                     │  │
│  │  - Row Level Security (RLS)                              │  │
│  │  - Session validation                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Frontend → Agents Service**: HTTP/REST API calls from browser
2. **Agents Service → OpenAI**: Agent execution via SDK
3. **Agents Service → Supabase**: Database queries for context and logging
4. **Frontend → Supabase**: Direct database access for real-time updates

## Getting Started

### Prerequisites

Before integrating the Agents SDK, ensure you have:

- ✅ Node.js 18.18.2+ (or 20.x)
- ✅ pnpm 10.x installed
- ✅ Supabase project set up
- ✅ OpenAI API key

### Installation Steps

The OpenAI Agents SDK is already installed in the `agents-service` package. To verify:

```bash
cd agents-service
pnpm list @openai/agents
# Should show: @openai/agents 0.2.1
```

### Environment Configuration

1. **Main application** (`.env.local`):
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

2. **Agents service** (`agents-service/.env`):
   ```bash
   OPENAI_API_KEY=sk-proj-...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   AGENTS_PORT=8787
   AGENT_TIMEOUT_MS=45000
   ```

### Starting the Services

```bash
# Install dependencies
pnpm install

# Start Supabase locally (optional)
pnpm supabase:start
pnpm supabase:reset

# Start main app
pnpm dev

# In another terminal: Start agents service
pnpm dev:agents

# Or start everything at once
pnpm dev:all
```

## Creating Your First Agent

### Step 1: Define the Agent

Create a new agent file in `libs/agents/` (for prototyping) or `agents-service/src/agents/` (for production):

```typescript
// libs/agents/myAgent.ts
import { Agent, tool } from '@openai/agents';
import { z } from 'zod';
import type { RunContext } from '@openai/agents';

// 1. Define your context type
interface MyAgentContext {
  userId?: string;
  tenantId?: string;
  language?: string;
}

// 2. Create tools
const searchTool = tool({
  name: 'search_items',
  description: 'Search for items in the database',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().describe('Maximum results'),
  }),
  execute: async (input) => {
    // Implement tool logic
    return { items: [], total: 0 };
  },
});

// 3. Define output schema
const OutputSchema = z.object({
  reply: z.string(),
  items: z.array(z.string()).optional(),
});

// 4. Create the agent
export const MyAgent = new Agent<MyAgentContext, typeof OutputSchema>({
  name: 'My Agent',
  instructions: async (runContext: RunContext<MyAgentContext>) => {
    const context = runContext.context;
    return `You are a helpful assistant for ${context?.language || 'English'} users...`;
  },
  model: 'gpt-4o',
  tools: [searchTool],
  outputType: OutputSchema,
});
```

### Step 2: Add API Endpoint

Integrate the agent into `agents-service/src/server.ts`:

```typescript
import { MyAgent } from '../../libs/agents/myAgent';
import { runner } from './agents/agents';

app.post('/agents/my-agent', async (request, reply) => {
  const { message, tenant_id, user_id } = request.body;
  
  const context = {
    tenantId: tenant_id,
    userId: user_id,
    language: 'English',
  };
  
  const result = await runner.run(MyAgent, message, { context });
  
  return reply.send({
    session_id: result.sessionId,
    output: result.finalOutput,
  });
});
```

### Step 3: Test the Agent

```bash
curl -X POST http://localhost:8787/agents/my-agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, help me find something",
    "tenant_id": "tenant-123",
    "user_id": "user-456"
  }'
```

## Integrating with Frontend

### Making API Calls

Create a service file for agent interactions:

```typescript
// src/services/agentService.ts
import { createFrontendClient } from '@/libs';

const AGENTS_API_URL = import.meta.env.VITE_AGENTS_API_URL || 'http://localhost:8787';

export async function callBookingAgent(message: string, context: {
  tenantId: string;
  userId?: string;
  locationId?: string;
}) {
  const response = await fetch(`${AGENTS_API_URL}/agents/booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      tenant_id: context.tenantId,
      user_id: context.userId,
      location_id: context.locationId,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.statusText}`);
  }
  
  return response.json();
}
```

### React Component Example

```typescript
// src/components/BookingChat.tsx
import { useState } from 'react';
import { callBookingAgent } from '@/services/agentService';

export function BookingChat() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await callBookingAgent(message, {
        tenantId: 'tenant-123',
        userId: 'user-456',
      });
      
      setResponse(result.output.reply);
    } catch (error) {
      console.error('Agent error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask about bookings..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </form>
      {response && <div>{response}</div>}
    </div>
  );
}
```

## Advanced Features

### Multi-Agent Hand-offs

Agents can hand off to specialized agents:

```typescript
export const TriageAgent = new Agent({
  name: 'Triage Agent',
  handoffs: [BookingAgent, MenuAgent, SupportAgent],
  instructions: 'Route user requests to the appropriate specialist agent...',
});
```

### Streaming Responses

For better UX, stream agent responses:

```typescript
app.post('/agents/my-agent/stream', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Stream agent output
  for await (const chunk of runner.stream(MyAgent, message, { context })) {
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  reply.raw.end();
});
```

### Voice Integration

Integrate with the Realtime API for voice:

```typescript
// See agents-service/src/ai/realtime/ for implementation
```

### Guardrails & Safety

Add custom guardrails:

```typescript
const safetyCheck = async (input: string) => {
  // Check for prohibited content
  if (input.includes('sensitive-term')) {
    throw new Error('Input blocked by safety policy');
  }
};

app.addHook('preHandler', async (request) => {
  const { message } = request.body;
  await safetyCheck(message);
});
```

## Deployment

### Production Checklist

- [ ] Set production OpenAI API key
- [ ] Configure Supabase production credentials
- [ ] Set appropriate timeout values
- [ ] Enable budget limits per session/day
- [ ] Configure OpenTelemetry exporter
- [ ] Set up monitoring and alerts
- [ ] Enable rate limiting
- [ ] Test fail-over scenarios

### Environment Variables

```bash
# Production environment
NODE_ENV=production
OPENAI_API_KEY=sk-prod-...
SUPABASE_URL=https://prod.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
AGENTS_PORT=8787
AGENT_TIMEOUT_MS=30000
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otel-collector
```

## Best Practices

### 1. Agent Design

✅ **DO:**
- Keep agents focused on specific domains
- Use clear, detailed instructions
- Validate all inputs with Zod
- Include examples in prompts

❌ **DON'T:**
- Create one agent for everything
- Use vague instructions
- Skip input validation
- Assume context without verification

### 2. Cost Management

✅ **DO:**
- Use gpt-4o-mini for simple tasks
- Implement token budget limits
- Cache frequently used data
- Monitor cost per session

❌ **DON'T:**
- Use gpt-4o for everything
- Ignore budget overruns
- Re-fetch static data repeatedly
- Skip cost tracking

### 3. Safety & Security

✅ **DO:**
- Always validate allergen info from database
- Implement kill switches
- Log safety-relevant decisions
- Use RLS policies in Supabase

❌ **DON'T:**
- Guess or infer safety info
- Expose service role key to browser
- Store PII in logs
- Skip error handling

### 4. User Experience

✅ **DO:**
- Provide loading indicators
- Stream responses when possible
- Handle errors gracefully
- Give clear feedback

❌ **DON'T:**
- Block UI during agent calls
- Show raw error messages
- Leave users hanging
- Overuse AI where simple UI works better

## Resources

- [OpenAI Agents SDK Documentation](https://platform.openai.com/docs/agents)
- [Agents Service README](../agents-service/README.md)
- [Libraries README](../libs/README.md)
- [ICUPA Architecture Docs](../docs/ARCHITECTURE.md)

## Support

For questions or issues:
- Check existing documentation
- Review example implementations in `libs/`
- Consult the agents-service README
- Open an issue in the repository

---

**Last Updated**: 2025-10-30  
**Version**: 0.1.0
