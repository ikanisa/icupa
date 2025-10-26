export type ToolTraceStatus = 'succeeded' | 'failed' | 'in_progress' | 'unknown';

export interface AgentToolTrace {
  trace_id?: string;
  agent_type?: string;
  tool?: string;
  status?: ToolTraceStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export type AgentSuggestedPromptSource = 'agent' | 'fallback';

export interface AgentSuggestedPrompt {
  id?: string;
  agent_type?: string;
  prompt?: string;
  source?: AgentSuggestedPromptSource;
  reason?: string;
}

export interface AgentRunMetadata {
  agent_type?: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  cost_usd?: number;
  tool_traces?: AgentToolTrace[];
  suggested_prompts?: AgentSuggestedPrompt[];
}

export interface AgentResponseMetadata {
  runs?: AgentRunMetadata[];
  suggested_prompts?: AgentSuggestedPrompt[];
}

export type AgentFeedbackRating = 'up' | 'down';

export interface AgentChatAssistantExtras {
  disclaimers?: string[];
  citations?: string[];
  upsell?: Array<{
    item_id?: string;
    name?: string;
    price_cents?: number;
    currency?: string;
    rationale?: string;
    allergens?: string[];
    tags?: string[];
    is_alcohol?: boolean;
    citations?: string[];
  }>;
  raw?: unknown;
}

export type AgentUpsellItem = NonNullable<AgentChatAssistantExtras['upsell']>[number];

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  primaryAgentType?: string | null;
  latencyMs?: number;
  feedback?: AgentFeedbackRating | null;
  metadata?: AgentResponseMetadata;
  quickReplies?: string[];
  extras?: AgentChatAssistantExtras;
  error?: string;
}

export interface AgentChatState {
  messages: AgentChatMessage[];
  sessionId?: string | null;
}

export interface AgentChatSendResult<TResponse> {
  response: TResponse;
  metadata?: AgentResponseMetadata;
}

export type AgentChatStreamEvent =
  | { type: 'typing'; agent: string; active: boolean }
  | { type: 'message'; agent: string; content: string }
  | { type: 'error'; agent: string; message: string };

export interface AgentEndpointConfig<TResponse> {
  agent: string;
  path: string;
  mapResponse: (response: TResponse) => Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'> & {
    role?: 'assistant';
  };
  buildPayload?: (options: {
    message: string;
    sessionId?: string | null;
    context?: Record<string, unknown>;
  }) => Record<string, unknown>;
  streamPath?: (sessionId: string) => string | null;
}

export type AgentFetchMethod = 'POST' | 'PUT';

export interface AgentChatError {
  status?: number;
  message: string;
}
