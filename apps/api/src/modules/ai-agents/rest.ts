import { outputSchemas } from "@icupa/agents";
import { z } from "zod";
import type { AgentRunService } from "./service";

const domainSchema = z.enum(Object.keys(outputSchemas) as [string, ...string[]]);

const createRunSchema = z.object({
  agentId: z.string(),
  projectId: z.string(),
  domain: domainSchema,
  input: z.unknown(),
});

const updateTaskSchema = z.object({
  runId: z.string(),
  task: z.object({
    id: z.string(),
    agentId: z.string(),
    name: z.string(),
    input: z.unknown(),
    status: z.string(),
    priority: z.number().optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    metadata: z.record(z.any()).optional(),
    toolInvocations: z.array(z.record(z.any())).optional(),
  }),
});

const finalizeRunSchema = z.object({
  runId: z.string(),
  domain: domainSchema,
  output: z.unknown(),
});

export function createRestHandlers(service: AgentRunService) {
  return {
    createRun: async (body: unknown) => {
      const parsed = createRunSchema.parse(body);
      const run = await service.createRun(parsed);
      return { status: 201, body: run };
    },
    listRuns: async (projectId: string) => {
      const runs = await service.listRuns(projectId);
      return { status: 200, body: runs };
    },
    recordTask: async (body: unknown) => {
      const parsed = updateTaskSchema.parse(body);
      const run = await service.recordTaskResult(parsed.runId, {
        ...parsed.task,
        status: parsed.task.status as never,
      });
      return { status: 200, body: run };
    },
    finalizeRun: async (body: unknown) => {
      const parsed = finalizeRunSchema.parse(body);
      const run = await service.finalizeRun(parsed.runId, parsed.output, parsed.domain);
      return { status: 200, body: run };
    },
  } as const;
}
