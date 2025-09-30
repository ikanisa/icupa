import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@icupa/ui/use-toast';
import { z } from 'zod';
import {
  AgentRunDetailsDialog,
  ChatComposer,
  ChatTranscript,
} from '@/components/ai';
import { useAgentChat } from '@/hooks/useAgentChat';
import type { AgentChatMessage, AgentFeedbackRating } from '@/types/agents';
import { parseAgentStreamEvent } from '@/lib/chat-stream';
import { AgentMetadataSchema } from '@/lib/agent-schemas';
import type { AdminTenant } from '@/hooks/useAdminTenants';
import { useMerchantLocations } from '@/hooks/useMerchantLocations';

const SupportResponseSchema = z.object({
  session_id: z.string().uuid(),
  summary: z.string(),
  ticket: z.object({
    id: z.string().uuid(),
    priority: z.enum(['low', 'medium', 'high']),
    recommended_channel: z.enum(['email', 'sms', 'push', 'phone']),
  }),
  next_steps: z.array(z.string()).optional().default([]),
  cost_usd: z.number().optional(),
  metadata: AgentMetadataSchema.optional(),
});

const ComplianceResponseSchema = z.object({
  session_id: z.string().uuid(),
  tasks: z
    .array(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['resolved', 'blocked', 'escalate']),
        notes: z.string(),
      })
    )
    .optional()
    .default([]),
  escalation_required: z.boolean().optional().default(false),
  cost_usd: z.number().optional(),
  metadata: AgentMetadataSchema.optional(),
});

type AdminAgent = 'support' | 'compliance';

type AgentConfig<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  path: string;
  intro: string;
  prompts: string[];
  mapResponse: (
    response: z.infer<TSchema>
  ) => Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
};

const ADMIN_AGENT_CONFIGS: Record<AdminAgent, AgentConfig<any>> = {
  support: {
    schema: SupportResponseSchema,
    path: '/agents/support',
    intro: 'Support concierge ready to triage escalations and suggest next actions for ops.',
    prompts: [
      'Summarize escalations for today',
      'Draft an email to the franchisee',
      'Identify guests waiting over 10 minutes',
    ],
    mapResponse: (response) => {
      const nextSteps = response.next_steps?.length
        ? `\nNext steps:\n- ${response.next_steps.join('\n- ')}`
        : '';
      return {
        content: `Ticket ${response.ticket.id} (${response.ticket.priority} priority via ${response.ticket.recommended_channel})\n\n${response.summary}${nextSteps}`,
        metadata: response.metadata,
        quickReplies: [
          'Escalate to area manager',
          'Schedule guest follow-up',
          'Share status in #ops',
        ],
        extras: {
          raw: response,
        },
      } satisfies Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
    },
  },
  compliance: {
    schema: ComplianceResponseSchema,
    path: '/agents/compliance',
    intro: 'Compliance guardian monitoring audits, DPIAs, and regulatory tasks.',
    prompts: [
      'List blockers for Malta audits',
      'Prepare escalation summary',
      'Show upcoming compliance deadlines',
    ],
    mapResponse: (response) => {
      const tasks = (response.tasks ?? []).map((task, index) => `${index + 1}. ${task.status.toUpperCase()} — ${task.notes}`);
      const escalation = response.escalation_required ? '\nEscalation required for unresolved items.' : '';
      return {
        content: tasks.length ? `Compliance tasks:\n${tasks.join('\n')}${escalation}` : `No active compliance tasks.${escalation}`,
        metadata: response.metadata,
        quickReplies: [
          'Assign owner for blocked items',
          'Draft compliance briefing',
          'Export latest audit log',
        ],
        extras: {
          raw: response,
        },
      } satisfies Omit<AgentChatMessage, 'id' | 'role' | 'createdAt'>;
    },
  },
};

export interface AdminAssistantPanelProps {
  tenant: AdminTenant | null;
}

export function AdminAssistantPanel({ tenant }: AdminAssistantPanelProps) {
  const [activeAgent, setActiveAgent] = useState<AdminAgent>('support');
  const [inputValue, setInputValue] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inspectedMessage, setInspectedMessage] = useState<AgentChatMessage | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const streamingEnabled = import.meta.env?.VITE_AGENTS_STREAMING === 'true';
  const pollingEnabled = import.meta.env?.VITE_AGENTS_LONG_POLLING === 'true';

  const agentConfig = ADMIN_AGENT_CONFIGS[activeAgent];
  const { data: allLocations } = useMerchantLocations();

  const tenantLocations = useMemo(
    () =>
      (allLocations ?? [])
        .filter((location) => location.tenantId === tenant?.id)
        .map((location) => ({ id: location.id, name: location.name })),
    [allLocations, tenant?.id]
  );

  useEffect(() => {
    if (tenantLocations.length === 0) {
      setSelectedLocationId(null);
      return;
    }
    const exists = tenantLocations.some((location) => location.id === selectedLocationId);
    if (!exists) {
      setSelectedLocationId(tenantLocations[0].id);
    }
  }, [selectedLocationId, tenantLocations]);

  const agentContext = useMemo(
    () => ({
      tenant_id: tenant?.id,
      location_id: selectedLocationId ?? undefined,
    }),
    [selectedLocationId, tenant?.id]
  );

  const chat = useAgentChat(
    useMemo(
      () => ({
        agent: activeAgent,
        path: agentConfig.path,
        parseResponse: (data: unknown) => {
          const parsed = agentConfig.schema.parse(data);
          return { response: parsed, metadata: parsed.metadata };
        },
        getSessionId: (result: { response: any }) => result.response.session_id,
        mapResponse: agentConfig.mapResponse,
        buildPayload: ({ message, sessionId, context }) => ({
          message,
          session_id: sessionId ?? undefined,
          tenant_id: context?.tenant_id,
          location_id: context?.location_id,
        }),
        parseStreamEvent: (payload: unknown) => parseAgentStreamEvent(payload, activeAgent),
        ...(streamingEnabled
          ? {
              streamPath: (sessionId: string) => `/agent-sessions/${sessionId}/stream`,
            }
          : {}),
        ...(pollingEnabled
          ? {
              pollPath: (sessionId: string) => `/agent-sessions/${sessionId}/events`,
              pollIntervalMs: 4000,
            }
          : {}),
      }),
      [activeAgent, agentConfig, pollingEnabled, streamingEnabled]
    )
  );

  const {
    messages,
    isStreaming,
    isSending,
    error,
    availablePrompts,
    sessionId,
    reset,
    sendMessage,
    submitFeedback,
    feedbackPendingMessageId,
  } = chat;

  useEffect(() => {
    reset();
    setInputValue('');
  }, [activeAgent, reset]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'AI assistant issue',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [error]);

  const introMessage = useMemo<AgentChatMessage>(
    () => ({
      id: `intro-${activeAgent}`,
      role: 'assistant',
      content: agentConfig.intro,
      createdAt: new Date(),
      quickReplies: [...agentConfig.prompts],
    }),
    [activeAgent, agentConfig]
  );

  const combinedMessages = useMemo(
    () => [introMessage, ...messages],
    [introMessage, messages]
  );

  const prompts = useMemo(() => {
    const unique = new Map<string, string>();
    agentConfig.prompts.forEach((prompt) => unique.set(prompt.toLowerCase(), prompt));
    availablePrompts.forEach((prompt) => unique.set(prompt.toLowerCase(), prompt));
    return Array.from(unique.values());
  }, [agentConfig.prompts, availablePrompts]);

  const handleSend = () => {
    if (!agentContext.location_id) {
      toast({
        title: 'Select a location',
        description: 'Choose a location to ground the assistant response.',
        variant: 'destructive',
      });
      return;
    }
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sendMessage(trimmed, agentContext);
    setInputValue('');
  };

  const handleFeedback = (message: AgentChatMessage, rating: AgentFeedbackRating) => {
    submitFeedback(message, rating, agentContext);
  };

  if (!tenant) {
    return (
      <Card className="glass-card border border-white/10 bg-white/5 p-6 text-white/70">
        <p>Select a tenant to chat with ICUPA.</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card flex h-[640px] flex-col border border-white/10 bg-white/5">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-white">Operations Copilot</CardTitle>
            <p className="text-xs text-white/60">Govern AI escalations and compliance for {tenant.name}.</p>
          </div>
          <Badge variant="outline" className="border-white/20 bg-white/10 text-white/70">
            {sessionId ? 'Session active' : 'Ready'}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeAgent === 'support' ? 'gradient' : 'ghost'}
              size="sm"
              className="rounded-full px-4 text-xs"
              onClick={() => setActiveAgent('support')}
            >
              Support
            </Button>
            <Button
              type="button"
              variant={activeAgent === 'compliance' ? 'gradient' : 'ghost'}
              size="sm"
              className="rounded-full px-4 text-xs"
              onClick={() => setActiveAgent('compliance')}
            >
              Compliance
            </Button>
          </div>
          <Select value={selectedLocationId ?? undefined} onValueChange={(value) => setSelectedLocationId(value)}>
            <SelectTrigger className="w-[220px] rounded-full border border-white/20 bg-white/10 text-xs text-white/80">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {tenantLocations.map((location) => (
                <SelectItem key={location.id} value={location.id} className="text-sm">
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <Separator className="bg-white/10" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <ChatTranscript
          messages={combinedMessages}
          isTyping={isStreaming}
          typingAgent={activeAgent}
          onInspectMetadata={(message) => {
            setInspectedMessage(message);
            setDetailsOpen(true);
          }}
          onFeedback={handleFeedback}
          feedbackPendingMessageId={feedbackPendingMessageId}
        />
        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSend}
          disabled={isSending}
          suggestions={prompts}
        />
      </CardContent>
      <AgentRunDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        message={inspectedMessage}
      />
    </Card>
  );
}
