import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentQueueManager, AgentJobData } from "../queues/agentQueue";

export interface OutboxDispatcherOptions {
  pollIntervalMs?: number;
  tableName?: string;
}

interface OutboxRecord {
  id: string;
  run_id: string;
  task_id: string;
  agent_id: string;
  task_name: string;
  code: string;
  input: unknown;
  domain: string;
  available_at: string;
  dispatched: boolean;
  metadata: Record<string, unknown> | null;
}

export class OutboxDispatcher {
  private readonly client: SupabaseClient;
  private readonly pollIntervalMs: number;
  private readonly tableName: string;
  private timer?: NodeJS.Timeout;

  constructor(private readonly queue: AgentQueueManager, options: OutboxDispatcherOptions = {}) {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.tableName = options.tableName ?? "agent_outbox";
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.dispatch().catch((error) => {
        console.error("Outbox dispatch error", error);
      });
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async dispatch() {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from<OutboxRecord>(this.tableName)
      .select("*")
      .eq("dispatched", false)
      .lte("available_at", now)
      .limit(25);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      return;
    }

    for (const record of data) {
      await this.enqueueRecord(record);
    }

    const ids = data.map((record) => record.id);
    await this.client
      .from(this.tableName)
      .update({ dispatched: true, dispatched_at: new Date().toISOString() })
      .in("id", ids);
  }

  private async enqueueRecord(record: OutboxRecord) {
    const payload: AgentJobData = {
      runId: record.run_id,
      taskId: record.task_id,
      agentId: record.agent_id,
      taskName: record.task_name,
      code: record.code,
      input: record.input,
      domain: record.domain,
      createdAt: record.available_at,
      metadata: record.metadata ?? undefined,
    };

    await this.queue.queue.add(record.task_id, payload, {
      jobId: `${record.run_id}:${record.task_id}`,
      delay: 0,
    });
  }
}
