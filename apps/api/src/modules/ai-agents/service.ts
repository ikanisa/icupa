import { randomUUID } from "node:crypto";
import {
  AgentEvent,
  AgentRun,
  AuditTrail,
  InMemoryVectorStore,
  ToolRegistry,
  agentEventSchema,
  outputSchemas,
  taskSchema,
  validateDomainOutput,
} from "@icupa/agents";
import type { AgentRunRecord, AgentRunRepositoryPort } from "./repository";

export interface CreateRunInput {
  agentId: string;
  projectId: string;
  domain: keyof typeof outputSchemas;
  input: unknown;
}

export interface AgentRunServiceDependencies {
  repository: AgentRunRepositoryPort;
  toolRegistry: ToolRegistry;
  auditTrail: AuditTrail;
  vectorStore?: InMemoryVectorStore;
}

export class AgentRunService {
  private readonly repository: AgentRunRepository;
  private readonly toolRegistry: ToolRegistry;
  private readonly auditTrail: AuditTrail;
  private readonly vectorStore: InMemoryVectorStore;

  constructor({ repository, toolRegistry, auditTrail, vectorStore }: AgentRunServiceDependencies) {
    this.repository = repository;
    this.toolRegistry = toolRegistry;
    this.auditTrail = auditTrail;
    this.vectorStore = vectorStore ?? new InMemoryVectorStore("agent-runs");
  }

  async createRun(input: CreateRunInput): Promise<AgentRunRecord> {
    const now = new Date();
    const run: AgentRun = {
      id: randomUUID(),
      agentId: input.agentId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      tasks: [],
    };

    const record: AgentRunRecord = {
      ...run,
      projectId: input.projectId,
      metadata: { domain: input.domain, input: input.input },
    };

    const saved = await this.repository.createRun(record);

    this.emitAudit({
      id: randomUUID(),
      runId: saved.id,
      type: "task.created",
      createdAt: now,
      payload: { input },
    });

    return saved;
  }

  async recordTaskResult(runId: string, taskUpdate: AgentRun["tasks"][number]): Promise<AgentRunRecord> {
    const createdAt = new Date(taskUpdate.createdAt as unknown as string | number | Date);
    const updatedAt = new Date(taskUpdate.updatedAt as unknown as string | number | Date);
    const normalizedTask = {
      ...taskUpdate,
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
      updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
    };
    const parsedTask = taskSchema.parse(normalizedTask);
    const run = await this.repository.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const tasks = run.tasks.filter((task) => task.id !== parsedTask.id).concat(parsedTask);
    const status = tasks.every((task) => task.status === "succeeded") ? "succeeded" : run.status;

    const updated = await this.repository.updateRun(runId, {
      tasks,
      status,
      updatedAt: new Date(),
    });

    await this.vectorStore.upsert([
      {
        id: parsedTask.id,
        values: parsedTask.metadata?.embedding as number[] | undefined ?? [],
        metadata: parsedTask.metadata,
      },
    ]);

    this.emitAudit({
      id: randomUUID(),
      runId,
      type: "task.updated",
      createdAt: new Date(),
      payload: parsedTask,
    });

    return updated;
  }

  async finalizeRun(runId: string, output: unknown, domain: string): Promise<AgentRunRecord> {
    const run = await this.repository.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const validatedOutput = validateDomainOutput(domain as never, output);
    const updated = await this.repository.updateRun(runId, {
      status: "succeeded",
      finalOutput: validatedOutput,
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    this.emitAudit({
      id: randomUUID(),
      runId,
      type: "run.completed",
      createdAt: new Date(),
      payload: { output: validatedOutput },
    });

    return updated;
  }

  async failRun(runId: string, error: Error): Promise<AgentRunRecord> {
    const updated = await this.repository.updateRun(runId, {
      status: "failed",
      error: { message: error.message, stack: error.stack },
      updatedAt: new Date(),
    });

    this.emitAudit({
      id: randomUUID(),
      runId,
      type: "run.failed",
      createdAt: new Date(),
      payload: { error: error.message },
    });

    return updated;
  }

  listRuns(projectId: string) {
    return this.repository.listRuns(projectId);
  }

  getRun(runId: string) {
    return this.repository.getRun(runId);
  }

  get tools() {
    return this.toolRegistry.list();
  }

  private emitAudit(event: AgentEvent) {
    const parsed = agentEventSchema.parse(event);
    this.auditTrail.emitEvent(parsed);
  }
}
