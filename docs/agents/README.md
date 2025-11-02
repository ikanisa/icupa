# AI Agents Platform Guide

This guide explains how to work with the task engine, background workers, and API layer introduced for AI agents. It is written for full-stack teams that need to orchestrate autonomous or semi-autonomous workflows while maintaining strong governance over safety, privacy, and observability.

## Architecture Overview

The platform is composed of the following building blocks:

- **`@icupa/agents` package** &mdash; Defines the core task/run models, validation schemas, tool registry, vector-store abstraction, sandbox interfaces, and audit hooks.
- **API module (`apps/api/src/modules/ai-agents`)** &mdash; Provides REST helpers, GraphQL schema/resolvers, and webhook utilities to expose agent functionality to first- and third-party clients.
- **`@icupa/workers` package** &mdash; Supplies BullMQ-based queue orchestration, retry/DLQ handling, and an outbox dispatcher for reliable background execution.
- **Integration tests (`tests/agents/agent-lifecycle.test.ts`)** &mdash; Demonstrate the expected end-to-end lifecycle, including tool invocation, idempotent task updates, and failure recovery semantics.

The diagram below summarises the event flow:

```
Client -> API REST/GraphQL -> Supabase (agent_runs, outbox) -> Outbox Dispatcher -> BullMQ Worker -> Audit Trail -> API Service -> Supabase
```

## Working with Tasks and Runs

1. Use the `ToolRegistry` to register capabilities with input/output schemas. Each tool receives a sandbox execution context with audit logging that automatically redacts PII.
2. Create new runs through the REST helper (`rest.createRun`) or GraphQL mutation (`createAgentRun`). The service persists a `pending` run with domain metadata for later validation.
3. Background workers dequeue jobs from Redis, execute the supplied code inside the `NodeSandboxRunner`, and emit audit events for task updates or run completion.
4. The API service listens to those audit events (directly or through webhooks) to persist progress and final outputs. Domain-specific schemas ensure structured responses for compliance, research, and support flows.

### Vector Store Usage

`InMemoryVectorStore` is provided for testing and development. Swap it with a production-ready implementation by creating a class that satisfies the `VectorStore` interface and injecting it into `AgentRunService`.

## Safety & Privacy Guidelines

- **PII Redaction:** All audit and tool events are filtered through `redactPii`, which masks email addresses, phone numbers, and other sensitive fields. Never log raw customer data.
- **Sandbox Execution:** Untrusted code runs inside the `NodeSandboxRunner`, which enforces execution timeouts and isolates console access. Adjust `timeoutMs` per job to minimise risk from long-running scripts.
- **Audit Trail Hooks:** Subscribe to `AuditTrail.onEvent` to push records into your observability platform or SIEM for traceability.
- **Validation Schemas:** Always use the exported domain schemas (`customerSupportResolutionSchema`, `researchBriefSchema`, `complianceChecklistSchema`) to validate model outputs before persisting or returning them to clients.
- **Idempotency:** Jobs are deduplicated via deterministic `jobId`s in the worker layer and by replacing tasks with matching `taskId`s inside the service. When designing custom tools, ensure they tolerate retries.

## Background Workers

- Configure Redis credentials through `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, and `REDIS_TLS`.
- The `AgentQueueManager` emits `task.updated`, `run.completed`, and `run.failed` events. Subscribe with `AgentJobProcessor` to connect queue activity to persistence logic.
- Dead-lettered jobs land in the `agent-jobs:dlq` queue (configurable). Monitor it and surface alerts when messages accumulate.
- The `OutboxDispatcher` polls the Supabase `agent_outbox` table (customisable) every five seconds by default. It marks records as dispatched after enqueuing them, supporting the transactional outbox pattern.

## API Surface Reference

### REST Helpers

| Handler | Description |
| --- | --- |
| `createRun(body)` | Validates request payload and persists a new run. |
| `listRuns(projectId)` | Fetches recent runs for a project. |
| `recordTask(body)` | Records a task update sent from a worker or webhook. |
| `finalizeRun(body)` | Validates the final output and marks the run as succeeded. |

### GraphQL Module

```ts
const module = createAiAgentsModule();
const { typeDefs, resolvers } = module.graphql;
```

- Provides a `JSON` scalar, `AgentRun` type, and mutations for creating/finalising runs.
- Expose `availableTools` query for dynamic capability discovery.

### Webhook Handler

Use `module.webhook(body)` to accept batched events from workers or third-party orchestrators. Events are validated and routed to the correct service methods.

## Operational Tips

- Run `pnpm test --filter agent-lifecycle` to execute the integration suite.
- Extend `ToolRegistry` with domain-specific tools by packaging execution code into the outbox table.
- For production, replace the in-memory vector store and repository with scalable alternatives (e.g., pgvector, Pinecone).

By following these patterns, teams can safely iterate on agent features while maintaining compliance, resilience, and observability.
