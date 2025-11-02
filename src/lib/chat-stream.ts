import type { AgentChatStreamEvent } from '@icupa/types/agents';

export function parseAgentStreamEvent(payload: unknown, fallbackAgent = 'assistant'): AgentChatStreamEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : null;
  if (!type) return null;

  const agent = typeof record.agent === 'string' ? record.agent : fallbackAgent;

  if (type === 'typing') {
    return {
      type: 'typing',
      agent,
      active: Boolean(record.active ?? true),
    };
  }

  if (type === 'message' && typeof record.content === 'string') {
    return {
      type: 'message',
      agent,
      content: record.content,
    };
  }

  if (type === 'error' && typeof record.message === 'string') {
    return {
      type: 'error',
      agent,
      message: record.message,
    };
  }

  return null;
}
