import { Queue, Worker, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import pRetry from "p-retry";
import type { SandboxRunner } from "@icupa/agents";
import { AuditTrail } from "@icupa/agents";

export interface AgentJobData {
  runId: string;
  taskId: string;
  agentId: string;
  taskName: string;
  code: string;
  input: unknown;
  domain: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AgentQueueOptions {
  name?: string;
  connection?: IORedis.RedisOptions;
  deadLetterQueueName?: string;
  defaultJobOptions?: JobsOptions;
  concurrency?: number;
  auditTrail?: AuditTrail;
}

export class AgentQueueManager {
  readonly queue: Queue<AgentJobData>;
  readonly dlq: Queue<AgentJobData>;
  private worker?: Worker<AgentJobData>;
  readonly auditTrail: AuditTrail;
  private readonly concurrency: number;

  constructor(private readonly runner: SandboxRunner, options: AgentQueueOptions = {}) {
    const connection = new IORedis(options.connection ?? getDefaultRedisConfig());
    const queueName = options.name ?? "agent-jobs";
    const deadLetterQueueName = options.deadLetterQueueName ?? `${queueName}:dlq`;

    this.queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: true,
        ...options.defaultJobOptions,
      },
    });

    this.dlq = new Queue(deadLetterQueueName, { connection });
    this.auditTrail = options.auditTrail ?? new AuditTrail();
    this.concurrency = options.concurrency ?? 5;
  }

  async start(concurrency = this.concurrency) {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(
      this.queue.name,
      async (job) => {
        const { runId, taskId, agentId, taskName, code, input, domain, createdAt, metadata } = job.data;
        try {
          const result = await pRetry(
            () => this.runner.execute(
              { code, input },
              {
                runId,
                taskId,
                logger: createWorkerLogger(job.id ?? taskId),
              }
            ),
            { retries: 2 }
          );

          await this.auditTrail.emitEvent({
            id: job.id ?? `${runId}:${taskId}`,
            runId,
            type: "task.updated",
            createdAt: new Date(),
            payload: {
              id: taskId,
              agentId,
              name: taskName,
              input,
              status: "succeeded",
              priority: metadata?.priority ?? 0,
              createdAt: new Date(createdAt),
              updatedAt: new Date(),
              metadata: { ...metadata, output: result.output },
              toolInvocations: [],
              attempts: job.attemptsMade + 1,
              maxAttempts: job.opts.attempts ?? 3,
            },
          });

          await this.auditTrail.emitEvent({
            id: `${runId}:completed`,
            runId,
            type: "run.completed",
            createdAt: new Date(),
            payload: { output: result.output, logs: result.logs, domain },
          });

          return result.output;
        } catch (error) {
          const attemptsAllowed = job.opts.attempts ?? 1;
          const attemptsMade = job.attemptsMade + 1;
          const isFinalAttempt = attemptsMade >= attemptsAllowed;

          if (isFinalAttempt) {
            await this.dlq.add(job.name ?? "failed", job.data, {
              attempts: 1,
              removeOnComplete: true,
            });

            await this.auditTrail.emitEvent({
              id: job.id ?? `${runId}:${taskId}`,
              runId,
              type: "run.failed",
              createdAt: new Date(),
              payload: { error: error instanceof Error ? error.message : String(error) },
            });
          }
          throw error;
        }
      },
      {
        connection: this.queue.client,
        concurrency,
      }
    );
  }

  async stop() {
    await this.worker?.close();
    await this.queue.close();
    await this.dlq.close();
  }

}

function getDefaultRedisConfig(): IORedis.RedisOptions {
  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  };
}

function createWorkerLogger(scope: string) {
  return {
    info: (message: string, details?: Record<string, unknown>) =>
      console.info(`[agent-worker:${scope}] ${message}`, details ?? {}),
    warn: (message: string, details?: Record<string, unknown>) =>
      console.warn(`[agent-worker:${scope}] ${message}`, details ?? {}),
    error: (message: string, details?: Record<string, unknown>) =>
      console.error(`[agent-worker:${scope}] ${message}`, details ?? {}),
  };
}
