import type { AgentEvent } from "@icupa/agents";
import type { AgentQueueManager } from "../queues/agentQueue";

export interface AgentLifecycleHandlers {
  onTaskUpdate: (event: AgentEvent) => Promise<void>;
  onRunCompleted: (event: AgentEvent) => Promise<void>;
  onRunFailed: (event: AgentEvent) => Promise<void>;
}

export class AgentJobProcessor {
  private unsubscribe?: () => void;

  constructor(private readonly queue: AgentQueueManager, private readonly handlers: AgentLifecycleHandlers) {}

  async start() {
    await this.queue.start();
    this.unsubscribe = this.queue.auditTrail.onEvent((event) => {
      switch (event.type) {
        case "task.updated":
          return this.handlers.onTaskUpdate(event);
        case "run.completed":
          return this.handlers.onRunCompleted(event);
        case "run.failed":
          return this.handlers.onRunFailed(event);
        default:
          return Promise.resolve();
      }
    });
  }

  async stop() {
    await this.queue.stop();
    this.unsubscribe?.();
  }
}
