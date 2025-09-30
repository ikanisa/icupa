import { z } from 'zod';

export const SuggestedPromptSchema = z.object({
  id: z.string(),
  agent_type: z.string(),
  prompt: z.string(),
  source: z.enum(['agent', 'fallback']),
  reason: z.string().optional(),
});

export const ToolTraceSchema = z.object({
  trace_id: z.string(),
  agent_type: z.string(),
  tool: z.string(),
  status: z.enum(['succeeded', 'failed', 'in_progress', 'unknown']),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
});

export const AgentRunSchema = z.object({
  agent_type: z.string(),
  model: z.string().optional(),
  usage: z
    .object({
      inputTokens: z.number().nonnegative(),
      outputTokens: z.number().nonnegative(),
    })
    .optional(),
  cost_usd: z.number().optional(),
  tool_traces: z.array(ToolTraceSchema),
  suggested_prompts: z.array(SuggestedPromptSchema),
});

export const AgentMetadataSchema = z.object({
  runs: z.array(AgentRunSchema),
  suggested_prompts: z.array(SuggestedPromptSchema),
});
