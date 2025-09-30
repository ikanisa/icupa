import { randomUUID } from 'crypto';

export type ToolTraceStatus = 'succeeded' | 'failed' | 'in_progress' | 'unknown';

export interface AgentToolTrace {
  trace_id: string;
  agent_type: string;
  tool: string;
  status: ToolTraceStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export interface AgentSuggestedPrompt {
  id: string;
  agent_type: string;
  prompt: string;
  source: 'agent' | 'fallback';
  reason?: string;
}

export interface AgentRunMetadata {
  agent_type: string;
  model?: string;
  usage?: { inputTokens: number; outputTokens: number };
  cost_usd?: number;
  tool_traces: AgentToolTrace[];
  suggested_prompts: AgentSuggestedPrompt[];
}

export interface AgentResponseMetadata {
  runs: AgentRunMetadata[];
  suggested_prompts: AgentSuggestedPrompt[];
}

interface ExtractOptions {
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;
  costUsd?: number;
  toolsUsed?: string[];
  fallbackSuggestedPrompts?: string[];
}

function serialiseValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => serialiseValue(item, seen));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) {
      return undefined;
    }
    seen.add(obj);
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'function') continue;
      output[key] = serialiseValue(val, seen);
    }
    return output;
  }
  return String(value);
}

function coerceIsoTimestamp(input: unknown): string | undefined {
  if (!input) return undefined;
  if (typeof input === 'number' && Number.isFinite(input)) {
    return new Date(input).toISOString();
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return undefined;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && trimmed.length < 15) {
      return new Date(numeric).toISOString();
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }
  if (input instanceof Date) {
    if (!Number.isNaN(input.valueOf())) {
      return input.toISOString();
    }
  }
  return undefined;
}

function normaliseStatus(status: unknown, error?: unknown): ToolTraceStatus {
  const text = typeof status === 'string' ? status.toLowerCase() : '';
  if (text.includes('success') || text.includes('complete') || text.includes('ok')) {
    return 'succeeded';
  }
  if (text.includes('fail') || text.includes('error') || text.includes('reject')) {
    return 'failed';
  }
  if (text.includes('progress') || text.includes('run') || text.includes('pending')) {
    return 'in_progress';
  }
  if (error) {
    return 'failed';
  }
  return 'unknown';
}

function formatError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(serialiseValue(error));
  } catch {
    return undefined;
  }
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function toToolTrace(agentType: string, candidate: Record<string, unknown>): AgentToolTrace | undefined {
  const rawToolName =
    candidate.toolName ??
    candidate.tool_name ??
    candidate.tool ??
    (typeof candidate.name === 'string' && (candidate.type?.toString().toLowerCase().includes('tool') ?? false)
      ? candidate.name
      : undefined);

  const tool = typeof rawToolName === 'string' && rawToolName.trim() ? rawToolName.trim() : undefined;
  const typeText = typeof candidate.type === 'string' ? candidate.type.toLowerCase() : '';

  if (!tool && !typeText.includes('tool')) {
    return undefined;
  }

  const traceId =
    typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id.trim()
      : typeof candidate.trace_id === 'string' && candidate.trace_id.trim()
      ? candidate.trace_id.trim()
      : typeof candidate.toolCallId === 'string' && candidate.toolCallId.trim()
      ? candidate.toolCallId.trim()
      : randomUUID();

  const status = normaliseStatus(candidate.status, candidate.error);
  const input = serialiseValue(
    candidate.arguments ??
      candidate.args ??
      candidate.input ??
      (candidate.request as Record<string, unknown> | undefined)?.arguments ??
      (candidate.call as Record<string, unknown> | undefined)?.arguments
  );

  const output = serialiseValue(
    candidate.output ??
      candidate.result ??
      candidate.response ??
      (candidate.call as Record<string, unknown> | undefined)?.outputs ??
      candidate.outputs
  );

  const error = formatError(candidate.error ?? (candidate.result as Record<string, unknown> | undefined)?.error);

  const startedAt =
    coerceIsoTimestamp(candidate.startedAt ?? candidate.started_at ?? (candidate.timestamps as Record<string, unknown> | undefined)?.startedAt) ??
    coerceIsoTimestamp(candidate.createdAt ?? candidate.created_at);

  const finishedAt =
    coerceIsoTimestamp(
      candidate.completedAt ??
        candidate.completed_at ??
        candidate.doneAt ??
        (candidate.timestamps as Record<string, unknown> | undefined)?.completedAt
    ) ?? coerceIsoTimestamp(candidate.updatedAt ?? candidate.updated_at);

  return {
    trace_id: traceId,
    agent_type: agentType,
    tool: tool ?? 'unknown',
    status,
    input,
    output,
    error,
    started_at: startedAt,
    finished_at: finishedAt
  } satisfies AgentToolTrace;
}

function collectToolTraces(agentType: string, state: unknown): AgentToolTrace[] {
  if (!state || typeof state !== 'object') return [];

  const map = new Map<string, AgentToolTrace>();
  const queue: unknown[] = [state];
  const seen = new WeakSet<object>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (typeof current !== 'object') continue;

    const obj = current as Record<string, unknown>;
    if (seen.has(obj)) continue;
    seen.add(obj);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    const maybeTrace = toToolTrace(agentType, obj);
    if (maybeTrace) {
      map.set(maybeTrace.trace_id, maybeTrace);
    }

    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return Array.from(map.values());
}

function toSuggestedPrompt(agentType: string, raw: unknown, source: 'agent' | 'fallback'): AgentSuggestedPrompt | undefined {
  if (!raw) return undefined;
  const id = randomUUID();

  if (typeof raw === 'string') {
    const prompt = raw.trim();
    if (!prompt) return undefined;
    return { id, agent_type: agentType, prompt, source } satisfies AgentSuggestedPrompt;
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const promptCandidate =
      obj.prompt ??
      obj.text ??
      obj.message ??
      obj.content ??
      obj.title ??
      obj.body ??
      (Array.isArray(obj.messages) ? obj.messages[0] : undefined);

    const promptText = typeof promptCandidate === 'string' ? promptCandidate.trim() : undefined;
    if (!promptText) return undefined;

    const reasonCandidate = obj.reason ?? obj.description ?? obj.tooltip;
    const reason = typeof reasonCandidate === 'string' ? reasonCandidate.trim() : undefined;

    const providedId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : id;
    return {
      id: providedId,
      agent_type: agentType,
      prompt: promptText,
      source,
      reason
    } satisfies AgentSuggestedPrompt;
  }

  return undefined;
}

function extractSuggestedPrompts(agentType: string, state: unknown): AgentSuggestedPrompt[] {
  if (!state || typeof state !== 'object') return [];

  const prompts: AgentSuggestedPrompt[] = [];
  const obj = state as Record<string, unknown>;
  const candidateKeys = ['suggestedActions', 'suggested_actions', 'suggestedPrompts', 'suggested_prompts'];

  for (const key of candidateKeys) {
    const value = obj[key as keyof typeof obj];
    if (Array.isArray(value)) {
      for (const entry of value) {
        const prompt = toSuggestedPrompt(agentType, entry, 'agent');
        if (prompt) {
          prompts.push(prompt);
        }
      }
    }
  }

  if (Array.isArray(obj.modelResponses)) {
    for (const response of obj.modelResponses as unknown[]) {
      if (!response || typeof response !== 'object') continue;
      const responseObj = response as Record<string, unknown>;
      const responses = responseObj.suggestedActions ?? responseObj.suggested_actions;
      if (Array.isArray(responses)) {
        for (const entry of responses) {
          const prompt = toSuggestedPrompt(agentType, entry, 'agent');
          if (prompt) {
            prompts.push(prompt);
          }
        }
      }
    }
  }

  return dedupeByKey(prompts, (item) => `${item.agent_type}:${item.prompt.toLowerCase()}`);
}

export function extractAgentRunMetadata(
  agentType: string,
  result: unknown,
  options: ExtractOptions = {}
): AgentRunMetadata {
  const state = (result as { state?: { toJSON?: () => unknown } })?.state?.toJSON?.();
  const toolTraces = collectToolTraces(agentType, state);

  let finalToolTraces = toolTraces;
  if (!finalToolTraces.length && Array.isArray(options.toolsUsed) && options.toolsUsed.length) {
    finalToolTraces = options.toolsUsed.map((tool) => ({
      trace_id: randomUUID(),
      agent_type: agentType,
      tool,
      status: 'unknown' as const
    } satisfies AgentToolTrace));
  }

  const promptsFromState = extractSuggestedPrompts(agentType, state);
  const fallbackPrompts = (options.fallbackSuggestedPrompts ?? [])
    .map((prompt) => toSuggestedPrompt(agentType, prompt, 'fallback'))
    .filter((prompt): prompt is AgentSuggestedPrompt => Boolean(prompt));

  const suggestedPrompts = dedupeByKey(
    [...promptsFromState, ...fallbackPrompts],
    (item) => `${item.agent_type}:${item.prompt.toLowerCase()}`
  );

  return {
    agent_type: agentType,
    model: options.model,
    usage: options.usage,
    cost_usd: options.costUsd,
    tool_traces: finalToolTraces,
    suggested_prompts: suggestedPrompts
  } satisfies AgentRunMetadata;
}

export function buildResponseMetadata(runs: AgentRunMetadata[]): AgentResponseMetadata {
  const suggestedPrompts = dedupeByKey(
    runs.flatMap((run) => run.suggested_prompts),
    (item) => `${item.agent_type}:${item.prompt.toLowerCase()}`
  );

  return {
    runs,
    suggested_prompts: suggestedPrompts
  } satisfies AgentResponseMetadata;
}

export function createMetadataCollector() {
  const runs: AgentRunMetadata[] = [];
  return {
    addRun(
      agentType: string,
      result: unknown,
      options: ExtractOptions = {}
    ) {
      const metadata = extractAgentRunMetadata(agentType, result, options);
      runs.push(metadata);
      return metadata;
    },
    get runs() {
      return runs;
    },
    build() {
      return buildResponseMetadata(runs);
    }
  };
}

