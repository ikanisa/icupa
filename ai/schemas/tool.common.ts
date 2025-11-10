import { z } from "zod";

// Common metadata shared by all tool invocations
export const baseToolInput = z.object({
  tenantId: z.string().uuid().nullish(),
  agentType: z.string().min(1).optional(),
  sessionId: z.string().uuid().optional(),
  requestId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type TBaseToolInput = z.infer<typeof baseToolInput>;

// Common tool definition structure
export const ToolDefinition = z.object({
  name: z.string(),
  description: z.string(),
  schema: z.any(),
});
export type TToolDefinition = z.infer<typeof ToolDefinition>;

// Tool call result
export const ToolCallResult = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});
export type TToolCallResult = z.infer<typeof ToolCallResult>;
