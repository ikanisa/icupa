import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { buildAgentUrl } from '@/lib/agents';
import type {
  AgentChatError,
  AgentChatMessage,
  AgentChatSendResult,
  AgentChatStreamEvent,
  AgentEndpointConfig,
  AgentResponseMetadata,
  AgentChatState,
  AgentFeedbackRating,
} from '@/types/agents';

interface SendMessageArgs {
  message: string;
  context?: Record<string, unknown>;
  startedAt: number;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

interface UseAgentChatOptions<TResponse> extends AgentEndpointConfig<TResponse> {
  parseResponse: (data: unknown) => AgentChatSendResult<TResponse>;
  getSessionId: (result: AgentChatSendResult<TResponse>) => string | undefined;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  pollPath?: (sessionId: string) => string | null;
  pollIntervalMs?: number;
  parseStreamEvent?: (payload: unknown) => AgentChatStreamEvent | null;
}

interface UseAgentChatResult {
  messages: AgentChatMessage[];
  sendMessage: (message: string, context?: Record<string, unknown>) => Promise<void>;
  isSending: boolean;
  isStreaming: boolean;
  error: AgentChatError | null;
  reset: () => void;
  sessionId: string | null;
  availablePrompts: string[];
  submitFeedback: (message: AgentChatMessage, rating: AgentFeedbackRating, context?: Record<string, unknown>) => Promise<void>;
  feedbackPendingMessageId: string | null;
}

function createAssistantMessage(
  payload: ReturnType<AgentEndpointConfig<any>['mapResponse']>
): Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'> {
  return {
    content: payload.content,
    metadata: payload.metadata,
    quickReplies: payload.quickReplies,
    extras: payload.extras,
    error: payload.error,
  };
}

function derivePrimaryAgent(
  metadata: AgentResponseMetadata | undefined,
  fallbackAgent: string
): string {
  return metadata?.runs?.[0]?.agent_type ?? fallbackAgent;
}

function mergePrompts(current: string[], incoming?: string[]): string[] {
  if (!incoming || incoming.length === 0) {
    return current;
  }
  const seen = new Set(current.map((prompt) => prompt.toLowerCase()));
  const next = [...current];
  for (const prompt of incoming) {
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(prompt);
  }
  return next;
}

function parseAgentError(error: unknown): AgentChatError {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as Error).message ?? 'Agent request failed');
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status?: number }).status : undefined;
    return { message, status };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'Agent request failed' };
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function normaliseQuickReplies(prompts?: Array<string | null | undefined>): string[] {
  if (!prompts || prompts.length === 0) {
    return [];
  }
  const normalized: string[] = [];
  for (const prompt of prompts) {
    if (typeof prompt !== 'string') continue;
    const trimmed = prompt.trim();
    if (!trimmed) continue;
    normalized.push(trimmed);
  }
  return normalized;
}

export function useAgentChat<TResponse>(options: UseAgentChatOptions<TResponse>): UseAgentChatResult {
  const [state, setState] = useState<AgentChatState>({ messages: [], sessionId: null });
  const [availablePrompts, setAvailablePrompts] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<AgentChatError | null>(null);
  const [feedbackPendingId, setFeedbackPendingId] = useState<string | null>(null);
  const pollTimerRef = useRef<number>();
  const streamRef = useRef<EventSource | null>(null);

  const mutation = useMutation<AgentChatSendResult<TResponse>, unknown, SendMessageArgs>({
    mutationFn: async ({ message, context }) => {
      const payload = options.buildPayload
        ? options.buildPayload({ message, sessionId: state.sessionId, context })
        : {
            message,
            session_id: state.sessionId ?? undefined,
            ...(context ?? {}),
          };

      const url = buildAgentUrl(options.path);
      if (!url) {
        throw new Error('Agent service URL is not configured.');
      }

      const response = await fetch(url, {
        method: options.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = typeof result?.message === 'string' ? result.message : `Agent returned ${response.status}`;
        const error = new Error(message) as Error & { status?: number; body?: unknown };
        error.status = response.status;
        error.body = result;
        throw error;
      }

      return options.parseResponse(result);
    },
    onMutate: () => {
      setIsStreaming(true);
      setError(null);
    },
    onSuccess: (result, variables) => {
      const sessionId = options.getSessionId(result) ?? state.sessionId ?? null;
      const assistantPayload = options.mapResponse(result.response);
      const assistantMessage = createAssistantMessage(assistantPayload);
      const metadata = assistantMessage.metadata ?? result.metadata;
      const payloadQuickReplies = normaliseQuickReplies(assistantPayload.quickReplies);
      const metadataQuickReplies = normaliseQuickReplies(
        result.metadata?.suggested_prompts?.map((prompt) => prompt.prompt)
      );
      const quickRepliesFromResponse = payloadQuickReplies.length > 0 ? payloadQuickReplies : metadataQuickReplies;
      const latencyMs = Math.max(0, Date.now() - variables.startedAt);
      const primaryAgentType = derivePrimaryAgent(metadata, options.agent);

      setState((prev) => ({
        sessionId,
        messages: [
          ...prev.messages,
          {
            id: createId(),
            role: 'assistant',
            content: assistantMessage.content,
            createdAt: new Date(),
            primaryAgentType,
            latencyMs,
            feedback: null,
            metadata,
            quickReplies: quickRepliesFromResponse,
            extras: assistantMessage.extras,
            error: assistantMessage.error,
          },
        ],
      }));

      setAvailablePrompts((current) => mergePrompts(current, quickRepliesFromResponse));

      setIsStreaming(false);
    },
    onError: (cause, variables) => {
      const parsed = parseAgentError(cause);
      setError(parsed);
      setIsStreaming(false);
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: createId(),
            role: 'assistant',
            content: parsed.message,
            createdAt: new Date(),
            primaryAgentType: options.agent,
            latencyMs: variables ? Math.max(0, Date.now() - variables.startedAt) : undefined,
            feedback: null,
            error: parsed.message,
          },
        ],
      }));
    },
  });

  const feedbackMutation = useMutation<
    void,
    unknown,
    { message: AgentChatMessage; rating: AgentFeedbackRating; context?: Record<string, unknown> }
  >({
    mutationFn: async ({ message, rating, context }) => {
      if (!state.sessionId) {
        throw new Error('Cannot submit feedback without an active session.');
      }

      const url = buildAgentUrl('/agent-feedback');
      if (!url) {
        throw new Error('Agent service URL is not configured.');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: state.sessionId,
          agent_type: message.primaryAgentType ?? options.agent,
          rating,
          message_id: message.id,
          tenant_id: context?.tenant_id,
          location_id: context?.location_id,
          table_session_id: context?.table_session_id,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => undefined);
        const messageText = typeof errorBody?.message === 'string'
          ? errorBody.message
          : `Feedback request failed with status ${response.status}`;
        const error = new Error(messageText);
        throw error;
      }
    },
    onMutate: ({ message }) => {
      setFeedbackPendingId(message.id);
    },
    onSuccess: (_data, variables) => {
      setFeedbackPendingId(null);
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((message) =>
          message.id === variables.message.id ? { ...message, feedback: variables.rating } : message
        ),
      }));
    },
    onError: () => {
      setFeedbackPendingId(null);
    },
  });

  const sendMessage = useCallback(
    async (input: string, context?: Record<string, unknown>) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      const userMessage: AgentChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        createdAt: new Date(),
        primaryAgentType: 'user',
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));
      setIsStreaming(true);
      setError(null);

      const startedAt = Date.now();

      await mutation.mutateAsync({ message: trimmed, context, startedAt }).catch(() => {
        // errors handled in onError; swallow here to avoid unhandled rejection warnings
      });
    },
    [mutation]
  );

  const handleStreamEvent = useCallback(
    (event: AgentChatStreamEvent) => {
      if (event.type === 'typing') {
        setIsStreaming(event.active);
        return;
      }
      if (event.type === 'message') {
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: createId(),
              role: 'assistant',
              content: event.content,
              createdAt: new Date(),
              primaryAgentType: event.agent ?? options.agent,
              feedback: null,
            },
          ],
        }));
        setIsStreaming(false);
        return;
      }
      if (event.type === 'error') {
        setError({ message: event.message });
        setIsStreaming(false);
      }
    },
    [options.agent]
  );

  const submitFeedback = useCallback(
    async (message: AgentChatMessage, rating: AgentFeedbackRating, context?: Record<string, unknown>) => {
      if (!message || message.role !== 'assistant') {
        return;
      }
      if (message.feedback === rating) {
        // Feedback already recorded; skip duplicate submissions.
        return;
      }
      await feedbackMutation.mutateAsync({ message, rating, context }).catch(() => {
        // errors handled in onError
      });
    },
    [feedbackMutation]
  );

  useEffect(() => {
    const sessionId = state.sessionId;
    if (!sessionId) {
      return () => {};
    }

    const { streamPath, pollPath, pollIntervalMs, parseStreamEvent } = options;
    let active = true;

    if (streamPath) {
      const streamTarget = streamPath(sessionId);
      const url = streamTarget ? buildAgentUrl(streamTarget) : null;
      if (url) {
        try {
          const source = new EventSource(url);
          streamRef.current = source;
          source.onmessage = (event) => {
            const payload = parseStreamEvent?.(safeJsonParse(event.data)) ?? null;
            if (payload) {
              handleStreamEvent(payload);
            }
          };
          source.onerror = () => {
            setIsStreaming(false);
            source.close();
            streamRef.current = null;
          };
        } catch (_error) {
          setIsStreaming(false);
        }
      }
    }

    if (pollPath) {
      const interval = pollIntervalMs ?? 4000;

      const tick = async () => {
        if (!active) return;
        const pollTarget = pollPath(sessionId);
        const url = pollTarget ? buildAgentUrl(pollTarget) : null;
        if (!url) return;
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Polling failed with status ${response.status}`);
          }
          const json = await response.json().catch(() => null);
          const event = parseStreamEvent?.(json);
          if (event) {
            handleStreamEvent(event);
          }
        } catch (_error) {
          // ignore polling errors, will retry
        } finally {
          if (active) {
            pollTimerRef.current = window.setTimeout(tick, interval);
          }
        }
      };

      pollTimerRef.current = window.setTimeout(tick, interval);
    }

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = undefined;
      }
    };
  }, [handleStreamEvent, options, state.sessionId]);

  const reset = useCallback(() => {
    setState({ messages: [], sessionId: null });
    setAvailablePrompts([]);
    setError(null);
    setIsStreaming(false);
    setFeedbackPendingId(null);
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
    }
  }, []);

  const sortedMessages = useMemo(() => {
    return [...state.messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [state.messages]);

  return {
    messages: sortedMessages,
    sendMessage,
    isSending: mutation.isPending,
    isStreaming,
    error,
    reset,
    sessionId: state.sessionId ?? null,
    availablePrompts,
    submitFeedback,
    feedbackPendingMessageId: feedbackPendingId,
  };
}

export type { UseAgentChatOptions, UseAgentChatResult };
