import { z } from "zod";

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
