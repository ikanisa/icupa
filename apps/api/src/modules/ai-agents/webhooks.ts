import { agentEventSchema } from "@icupa/agents";
import { z } from "zod";
import type { AgentRunService } from "./service";

const eventEnvelopeSchema = z.object({
  events: z.array(agentEventSchema.extend({ domain: z.string().optional(), output: z.unknown().optional() })).min(1),
});

export function createWebhookHandler(service: AgentRunService) {
  return async function handle(body: unknown) {
    const { events } = eventEnvelopeSchema.parse(body);
    for (const event of events) {
      switch (event.type) {
        case "task.updated":
          await service.recordTaskResult(event.runId, event.payload as any);
          break;
        case "run.completed": {
          const payload = event.payload as any;
          const domain = payload?.domain ?? (event as any).domain ?? "customer-support";
          await service.finalizeRun(event.runId, payload?.output, domain);
          break;
        }
        case "run.failed":
          await service.failRun(event.runId, new Error((event.payload as any).error ?? "Unknown error"));
          break;
        default:
          // No-op for now
          break;
      }
    }

    return { status: 202, body: { received: events.length } };
  };
}
