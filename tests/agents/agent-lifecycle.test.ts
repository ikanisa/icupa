import { randomUUID } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuditTrail, ToolRegistry, customerSupportResolutionSchema } from "@icupa/agents";
import type { AgentEvent } from "@icupa/agents";
import { z } from "zod";
import { AgentJobProcessor, type AgentLifecycleHandlers } from "@icupa/workers";
import type { AgentRunRecord, AgentRunRepositoryPort } from "../../apps/api/src/modules/ai-agents/repository";
import { AgentRunService } from "../../apps/api/src/modules/ai-agents/service";

class InMemoryAgentRunRepository implements AgentRunRepositoryPort {
  private runs = new Map<string, AgentRunRecord>();
  private events: AgentEvent[] = [];

  async createRun(record: AgentRunRecord): Promise<AgentRunRecord> {
    this.runs.set(record.id, structuredClone(record));
    return this.getRun(record.id) as Promise<AgentRunRecord>;
  }

  async updateRun(runId: string, updates: Partial<AgentRunRecord>): Promise<AgentRunRecord> {
    const current = this.runs.get(runId);
    if (!current) {
      throw new Error(`Run ${runId} not found`);
    }
    const next: AgentRunRecord = {
      ...current,
      ...structuredClone(updates),
      tasks: updates.tasks ? structuredClone(updates.tasks) : current.tasks,
    } as AgentRunRecord;
    this.runs.set(runId, next);
    return structuredClone(next);
  }

  async appendEvent(_runId: string, event: AgentEvent): Promise<void> {
    this.events.push(event);
  }

  async listRuns(projectId: string): Promise<AgentRunRecord[]> {
    return Array.from(this.runs.values())
      .filter((run) => run.projectId === projectId)
      .map((run) => structuredClone(run));
  }

  async getRun(runId: string): Promise<AgentRunRecord | null> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }
}

class FakeQueueManager {
  readonly auditTrail = new AuditTrail();
  started = false;

  async start() {
    this.started = true;
  }

  async stop() {
    this.started = false;
  }

  async emit(event: AgentEvent) {
    if (!this.started) {
      throw new Error("Queue not started");
    }
    await this.auditTrail.emitEvent(event);
  }
}

describe("agent lifecycle integration", () => {
  let repository: InMemoryAgentRunRepository;
  let toolRegistry: ToolRegistry;
  let auditTrail: AuditTrail;
  let service: AgentRunService;
  let queue: FakeQueueManager;
  let processor: AgentJobProcessor;
  const now = new Date();

  beforeEach(async () => {
    repository = new InMemoryAgentRunRepository();
    toolRegistry = new ToolRegistry();
    auditTrail = new AuditTrail();

    service = new AgentRunService({
      repository,
      toolRegistry,
      auditTrail,
    });

    queue = new FakeQueueManager();

    const handlers: AgentLifecycleHandlers = {
      onTaskUpdate: (event) => service.recordTaskResult(event.runId, event.payload as any),
      onRunCompleted: (event) => service.finalizeRun(event.runId, (event.payload as any).output, (event.payload as any).domain),
      onRunFailed: (event) =>
        service.failRun(event.runId, new Error((event.payload as any).error ?? "unknown")),
    };

    processor = new AgentJobProcessor(queue as any, handlers);
    await processor.start();

    toolRegistry.register({
      name: "ticket-summarizer",
      description: "Summarises customer tickets",
      inputSchema: z.object({ email: z.string().email(), issue: z.string() }),
      outputSchema: customerSupportResolutionSchema,
      execute: async (input) => ({
        ticketId: `TICK-${input.email.split("@")[0]}`,
        summary: input.issue,
        resolutionSteps: [
          { title: "Acknowledge", description: "Inform the customer", status: "completed" },
        ],
        customerImpact: "low",
        escalationRequired: false,
      }),
    });
  });

  it("processes runs end-to-end with idempotent updates", async () => {
    const run = await service.createRun({
      agentId: "agent-1",
      projectId: "project-1",
      domain: "customer-support",
      input: { email: "user@example.com", issue: "Need help" },
    });

    const auditEvents: AgentEvent[] = [];
    auditTrail.onEvent((event) => {
      auditEvents.push(event);
    });

    const taskId = "task-1";
    const toolOutput = await toolRegistry.invoke(
      "ticket-summarizer",
      { email: "user@example.com", issue: "Need help" },
      {
        runId: run.id,
        taskId,
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        audit: (message, details) =>
          auditTrail.emitEvent({
            id: randomUUID(),
            runId: run.id,
            type: message === "tool.completed" ? "tool.called" : "tool.called",
            createdAt: new Date(),
            payload: details ?? {},
          }),
      }
    );

    expect(toolOutput.ticketId).toContain("TICK-");
    expect(JSON.stringify(auditEvents)).not.toContain("user@example.com");
    expect(JSON.stringify(auditEvents)).toContain("[redacted]");

    const taskEvent: AgentEvent = {
      id: randomUUID(),
      runId: run.id,
      type: "task.updated",
      createdAt: new Date(now.getTime() + 1),
      payload: {
        id: taskId,
        agentId: run.agentId,
        name: "Ticket triage",
        input: run.metadata?.input,
        status: "succeeded",
        priority: 1,
        createdAt: now.toISOString(),
        updatedAt: new Date(now.getTime() + 1).toISOString(),
        metadata: { output: toolOutput },
        toolInvocations: [],
        attempts: 1,
        maxAttempts: 3,
      },
    };

    await queue.emit(taskEvent);

    const completionEvent: AgentEvent = {
      id: randomUUID(),
      runId: run.id,
      type: "run.completed",
      createdAt: new Date(now.getTime() + 2),
      payload: { output: toolOutput, domain: "customer-support" },
    };

    await queue.emit(completionEvent);

    const updated = await service.getRun(run.id);
    expect(updated?.status).toBe("succeeded");
    expect(updated?.tasks).toHaveLength(1);
    expect(updated?.finalOutput).toMatchObject(toolOutput);

    // Emit duplicate events to confirm idempotency
    await queue.emit(taskEvent);
    await queue.emit(completionEvent);

    const afterDuplicate = await service.getRun(run.id);
    expect(afterDuplicate?.tasks).toHaveLength(1);
    expect(afterDuplicate?.finalOutput).toMatchObject(toolOutput);
  });

  it("marks runs as failed when failure events are received", async () => {
    const run = await service.createRun({
      agentId: "agent-2",
      projectId: "project-1",
      domain: "customer-support",
      input: {},
    });

    await queue.emit({
      id: randomUUID(),
      runId: run.id,
      type: "run.failed",
      createdAt: new Date(),
      payload: { error: "Tool crashed" },
    });

    const failed = await service.getRun(run.id);
    expect(failed?.status).toBe("failed");
    expect(failed?.error?.message).toBe("Tool crashed");
  });
});
