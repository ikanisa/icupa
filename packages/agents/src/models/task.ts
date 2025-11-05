import { z } from "zod";

export const taskStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const toolInvocationSchema = z.object({
  toolName: z.string(),
  input: z.unknown(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  output: z.unknown().optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
      retryable: z.boolean().optional(),
    })
    .optional(),
});

export type ToolInvocation = z.infer<typeof toolInvocationSchema>;

export const taskSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  name: z.string(),
  input: z.record(z.any()).or(z.unknown()),
  status: taskStatusSchema,
  priority: z.number().int().min(0).default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  vectorReference: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  toolInvocations: z.array(toolInvocationSchema).default([]),
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
});

export type Task = z.infer<typeof taskSchema>;

export const agentRunSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  status: taskStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  tasks: z.array(taskSchema).default([]),
  finalOutput: z.unknown().optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export type AgentRun = z.infer<typeof agentRunSchema>;

export const agentEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  type: z.enum(["task.created", "task.updated", "tool.called", "run.completed", "run.failed"]),
  createdAt: z.coerce.date(),
  payload: z.record(z.any()),
});

export type AgentEvent = z.infer<typeof agentEventSchema>;
