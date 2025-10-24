import 'dotenv/config';
import './telemetry';
import Fastify from 'fastify';
import { Agent } from '@openai/agents';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { z } from 'zod';
import { loadConfig } from './config/index';
import {
  upsellAgent,
  allergenGuardianAgent,
  waiterAgent,
  promoAgent,
  inventoryAgent,
  supportAgent,
  complianceAgent,
  runner,
  applyAllergenFilter,
} from './agents/agents';
import { buildAgentContext } from './services/context';
import {
  ensureAgentEnabled,
  assertBudgetsAfterRun,
  createAgentSessionRecord,
  logAgentEvent,
  recordRecommendationImpressions,
  recordAgentFeedback
} from './services/telemetry';
import type { AgentSessionContext, UpsellSuggestion, WaiterOutput } from './agents/types';
import {
  WaiterOutputSchema,
  UpsellOutputSchema,
  AllergenGuardianOutputSchema,
  PromoAgentOutputSchema,
  InventoryAgentOutputSchema,
  SupportAgentOutputSchema,
  ComplianceAgentOutputSchema,
} from './agents/types';
import { estimateCostUsd } from './utils/pricing';
import {
  createMetadataCollector,
  extractAgentRunMetadata,
  buildResponseMetadata
} from './utils/agent-metadata';
import {
  AgentFeedbackSchema,
  ComplianceRequestSchema,
  InventoryRequestSchema,
  PromoRequestSchema,
  SupportRequestSchema,
  WaiterRequest,
  WaiterRequestSchema,
  ensureLocationOrSession,
} from './routes/schemas';
import { openAIModels } from './openai/client';

const config = loadConfig();
const { default: defaultModel, lowCost: lowCostModel } = openAIModels;

const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
  }
});

function extractUsage(result: any): { inputTokens: number; outputTokens: number } {
  const stateJson = result?.state?.toJSON?.();
  if (!stateJson?.modelResponses) {
    return { inputTokens: 0, outputTokens: 0 };
  }

  return stateJson.modelResponses.reduce(
    (acc: { inputTokens: number; outputTokens: number }, response: any) => {
      acc.inputTokens += response?.usage?.inputTokens ?? 0;
      acc.outputTokens += response?.usage?.outputTokens ?? 0;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0 }
  );
}

const ALLOWED_CITATION_PREFIXES = ['menu:', 'allergens:', 'policies:'] as const;
const DEFAULT_AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? '45000');

function addDisclaimer(bucket: Set<string>, value?: string | null) {
  if (!value) return;
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    bucket.add(trimmed);
  }
}

function sanitiseCitations(citations: string[], disclaimers: Set<string>) {
  const filtered = citations.filter((citation) =>
    ALLOWED_CITATION_PREFIXES.some((prefix) => citation.startsWith(prefix))
  );

  if (!filtered.length) {
    addDisclaimer(disclaimers, 'Citations unavailable from the model output; falling back to policy reference.');
    return ['policies:ops'];
  }

  return filtered;
}

function summariseSuggestionsForTelemetry(suggestions: UpsellSuggestion[]) {
  if (!suggestions.length) return 'No suggestions produced.';
  return suggestions
    .map(
      (suggestion) =>
        `${suggestion.name} (${(suggestion.price_cents / 100).toFixed(2)} ${suggestion.currency})`
    )
    .join('; ');
}

function summariseBlockedSuggestions(
  blocked: { item_id: string; reason?: string; allergens: string[] }[],
  context: AgentSessionContext
) {
  if (!blocked.length) return 'No conflicts detected.';
  const menuIndex = new Map(context.menu.map((item) => [item.id, item.name]));
  return blocked
    .map((entry) => {
      const name = menuIndex.get(entry.item_id) ?? entry.item_id;
      const detail = entry.allergens.length ? entry.allergens.join(', ') : entry.reason ?? 'policy conflict';
      return `${name}: ${detail}`;
    })
    .join('; ');
}

function buildWaiterSuggestedPrompts(context: AgentSessionContext, output: WaiterOutput): string[] {
  const prompts: string[] = [];
  const seenNames = new Set<string>();
  const candidates = (output.upsell?.length ? output.upsell : context.suggestions) ?? [];

  for (const suggestion of candidates) {
    const name = suggestion?.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    prompts.push(`Tell me more about ${name}`);
    if (prompts.length >= 2) break;
  }

  if (candidates.length) {
    const first = candidates[0]?.name?.trim();
    if (first) {
      prompts.push(`Add ${first} to my order`);
    }
  }

  if (context.cart.length) {
    prompts.push('Review my current order');
  } else {
    prompts.push('Show popular dishes');
  }

  if (context.allergies.length) {
    prompts.push('Filter items to avoid my allergens');
  } else {
    prompts.push('What are today\'s specials?');
  }

  const unique: string[] = [];
  const seenPrompts = new Set<string>();
  for (const prompt of prompts) {
    const key = prompt.toLowerCase();
    if (seenPrompts.has(key)) continue;
    seenPrompts.add(key);
    unique.push(prompt);
    if (unique.length >= 5) break;
  }

  return unique;
}

async function runAgentWithTimeout(
  agent: Agent<AgentSessionContext, any>,
  message: string,
  context: AgentSessionContext,
  timeoutMs = DEFAULT_AGENT_TIMEOUT_MS,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Agent ${agent.name ?? 'unknown'} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return (await Promise.race([
      runner.run(agent, message, { context }),
      timeoutPromise,
    ])) as any;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

const tracer = trace.getTracer('icupa-agents-service');

async function executeManagedAgentRun<TOutput>(params: {
  agentType: string;
  agent: Agent<AgentSessionContext, any>;
  message: string;
  context: AgentSessionContext;
  toolsUsed: string[];
  schema: z.ZodSchema<TOutput>;
  sessionId?: string;
  timeoutMs?: number;
  fallbackSuggestedPrompts?: string[];
  model?: string;
}) {
  return tracer.startActiveSpan(`agent:${params.agentType}`, async (span) => {
    span.setAttribute('icupa.agent.type', params.agentType);
    if (params.toolsUsed.length) {
      span.setAttribute('icupa.agent.tools', params.toolsUsed.join(','));
    }

    const runtime = await ensureAgentEnabled(params.agentType, params.context.tenantId);
    const sessionId = params.sessionId ?? (await createAgentSessionRecord(params.agentType, params.context));
    params.context.sessionId = sessionId;

    const startedAt = Date.now();

    try {
      const result = await runAgentWithTimeout(
        params.agent,
        params.message,
        params.context,
        params.timeoutMs,
      );

      const usage = extractUsage(result);
      const parsedOutput = params.schema.parse(result?.finalOutput ?? {});
      const modelName = params.model ?? defaultModel;
      const costEstimate = estimateCostUsd(modelName, usage);

      const runMetadata = extractAgentRunMetadata(params.agentType, result, {
        usage,
        model: modelName,
        costUsd: costEstimate,
        toolsUsed: params.toolsUsed,
        fallbackSuggestedPrompts: params.fallbackSuggestedPrompts,
      });
      const responseMetadata = buildResponseMetadata([runMetadata]);

      await assertBudgetsAfterRun(params.agentType, params.context.tenantId, runtime, costEstimate);

      await logAgentEvent({
        agentType: params.agentType as any,
        context: params.context,
        sessionId,
        input: params.message,
        output: JSON.stringify(parsedOutput),
        toolsUsed: params.toolsUsed,
        startedAt,
        model: modelName,
        usage,
        payload: {
          metadata: responseMetadata,
          tool_traces: runMetadata.tool_traces,
          suggested_prompts: runMetadata.suggested_prompts,
        },
      });

      span.setAttribute('icupa.agent.cost_usd', costEstimate);
      span.setStatus({ code: SpanStatusCode.OK });

      return { sessionId, output: parsedOutput, costUsd: costEstimate, metadata: responseMetadata };
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Agent execution failed',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

function buildDisclaimers(context: AgentSessionContext, blocked: { item_id: string; reason?: string; allergens: string[] }[]) {
  if (!blocked.length) return [] as string[];
  const menuIndex = new Map(context.menu.map((item) => [item.id, item]));
  return blocked.map((entry) => {
    const item = menuIndex.get(entry.item_id);
    const name = item?.name ?? entry.item_id;
    const allergens = entry.allergens.join(', ') || 'declared allergen';
    return `${name} withheld because it contains ${allergens}.`;
  });
}

app.setErrorHandler((error, _, reply) => {
  if (error instanceof z.ZodError) {
    return reply.status(400).send({ error: 'invalid_request', details: error.issues });
  }

  if (/disabled/i.test(error.message ?? '')) {
    return reply.status(503).send({ error: 'agent_disabled', message: error.message });
  }

  if (/budget/i.test(error.message ?? '')) {
    return reply.status(429).send({ error: 'agent_budget_exceeded', message: error.message });
  }

  reply.status(500).send({ error: 'internal_error', message: error.message });
});

app.get('/health', async () => ({
  status: 'ok',
  region: config.region,
  uptime_seconds: process.uptime()
}));

app.get('/', async () => ({
  message: 'ICUPA agents service is running.',
  region: config.region
}));

app.post('/agents/waiter', async (request, reply) => {
  const parseResult = WaiterRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'invalid_request', details: parseResult.error.issues });
  }

  const body = parseResult.data;
  ensureLocationOrSession(body);

  const context = await buildAgentContext({
    tenantId: body.tenant_id,
    locationId: body.location_id,
    tableSessionId: body.table_session_id,
    userId: body.user_id,
    language: body.language,
    allergies: body.allergies,
    cart: body.cart,
    ageVerified: body.age_verified
  });

  const metadataCollector = createMetadataCollector();

  const waiterRuntime = await ensureAgentEnabled('waiter', context.tenantId);

  const sessionId = body.session_id ?? (await createAgentSessionRecord('waiter', context));
  context.sessionId = sessionId;

  const disclaimers = new Set<string>();
  let totalCostUsd = 0;

  const upsellRunStarted = Date.now();
  let upsellUsage = { inputTokens: 0, outputTokens: 0 };
  try {
    const upsellRuntime = await ensureAgentEnabled('upsell', context.tenantId);
    const upsellResult = await runner.run(upsellAgent, body.message, { context });
    upsellUsage = extractUsage(upsellResult);
    const upsellOutput = UpsellOutputSchema.parse(upsellResult.finalOutput ?? { suggestions: [] });
    context.suggestions = upsellOutput.suggestions as UpsellSuggestion[];

    const upsellCostEstimate = estimateCostUsd(defaultModel, upsellUsage);
    await assertBudgetsAfterRun('upsell', context.tenantId, upsellRuntime, upsellCostEstimate);

    const upsellCostUsd = await logAgentEvent({
      agentType: 'upsell',
      context,
      sessionId,
      input: body.message,
      output: summariseSuggestionsForTelemetry(context.suggestions),
      toolsUsed: ['get_menu', 'recommend_items', 'check_allergens', 'get_kitchen_load'],
      startedAt: upsellRunStarted,
      model: defaultModel,
      usage: upsellUsage,
      payload: {
        suggestions: context.suggestions,
        summary: summariseSuggestionsForTelemetry(context.suggestions),
      },
    });

    totalCostUsd += upsellCostUsd;

    metadataCollector.addRun('upsell', upsellResult, {
      usage: upsellUsage,
      model: defaultModel,
      costUsd: upsellCostUsd,
      toolsUsed: ['get_menu', 'recommend_items', 'check_allergens', 'get_kitchen_load']
    });
  } catch (error) {
    request.log.warn({ err: error }, 'Upsell agent unavailable');
    addDisclaimer(
      disclaimers,
      'Upsell suggestions are temporarily unavailable. Please ask a team member for recommendations.'
    );
    context.suggestions = [];
    await logAgentEvent({
      agentType: 'upsell',
      context,
      sessionId,
      input: body.message,
      output: error instanceof Error ? error.message : 'Upsell agent unavailable.',
      toolsUsed: [],
      startedAt: upsellRunStarted,
      model: defaultModel,
      outcome: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      payload: {
        suggestions: [],
      },
    });

    metadataCollector.addRun('upsell', undefined, {
      model: defaultModel,
      toolsUsed: ['get_menu', 'recommend_items', 'check_allergens', 'get_kitchen_load']
    });
  }

  let guardianUsage = { inputTokens: 0, outputTokens: 0 };
  if (context.suggestions.length > 0) {
    const guardianRunStarted = Date.now();
    const guardianRuntime = await ensureAgentEnabled('allergen_guardian', context.tenantId);
    const guardianResult = await runner.run(
      allergenGuardianAgent,
      JSON.stringify({ suggestions: context.suggestions }),
      { context }
    );
    guardianUsage = extractUsage(guardianResult);
   const guardianOutput = AllergenGuardianOutputSchema.parse(guardianResult.finalOutput ?? {});

    const blockedDisclaimers = buildDisclaimers(context, guardianOutput.blocked ?? []);
    blockedDisclaimers.forEach((message) => addDisclaimer(disclaimers, message));
    (guardianOutput.notes ?? []).forEach((note) => addDisclaimer(disclaimers, note));

    const filtered = applyAllergenFilter(context.suggestions, guardianOutput);
    if (filtered.length === 0) {
      addDisclaimer(disclaimers, 'All upsell suggestions were removed because of allergen or policy conflicts.');
    }
    context.suggestions = filtered;

    const guardianCostEstimate = estimateCostUsd(defaultModel, guardianUsage);
    await assertBudgetsAfterRun('allergen_guardian', context.tenantId, guardianRuntime, guardianCostEstimate);

    const guardianCostUsd = await logAgentEvent({
      agentType: 'allergen_guardian',
      context,
      sessionId,
      input: JSON.stringify({ suggestions: context.suggestions }),
      output: summariseBlockedSuggestions(guardianOutput.blocked ?? [], context),
      toolsUsed: ['check_allergens'],
      startedAt: guardianRunStarted,
      model: defaultModel,
      usage: guardianUsage,
      payload: {
        blocked: guardianOutput.blocked ?? [],
        notes: guardianOutput.notes ?? [],
        remaining_suggestions: context.suggestions,
      },
    });

    totalCostUsd += guardianCostUsd;

    metadataCollector.addRun('allergen_guardian', guardianResult, {
      usage: guardianUsage,
      model: defaultModel,
      costUsd: guardianCostUsd,
      toolsUsed: ['check_allergens']
    });
  }

  await recordRecommendationImpressions(context, sessionId, context.suggestions);

  const waiterRunStarted = Date.now();
  const waiterResult = await runner.run(waiterAgent, body.message, { context });
  const waiterUsage = extractUsage(waiterResult);
  const waiterOutput = waiterResult.finalOutput;
  if (!waiterOutput) {
    throw new Error('Waiter agent did not produce a response.');
  }
  const parsedWaiterOutput = WaiterOutputSchema.parse(waiterOutput);

  const waiterCostEstimate = estimateCostUsd(defaultModel, waiterUsage);
  await assertBudgetsAfterRun('waiter', context.tenantId, waiterRuntime, waiterCostEstimate);

  const waiterSuggestedPrompts = buildWaiterSuggestedPrompts(context, parsedWaiterOutput);

  metadataCollector.addRun('waiter', waiterResult, {
    usage: waiterUsage,
    model: defaultModel,
    costUsd: waiterCostEstimate,
    toolsUsed: ['get_menu', 'create_order', 'get_kitchen_load', 'check_allergens'],
    fallbackSuggestedPrompts: waiterSuggestedPrompts
  });

  const safeContextSuggestions = context.suggestions ?? [];

  const invalidUpsell = (parsedWaiterOutput.upsell ?? []).filter(
    (suggestion) => !safeContextSuggestions.some((item) => item.item_id === suggestion.item_id)
  );
  if (invalidUpsell.length) {
    addDisclaimer(disclaimers, 'Some model suggestions were removed because they bypassed safety checks.');
  }

  (parsedWaiterOutput.disclaimers ?? []).forEach((message) => addDisclaimer(disclaimers, message));

  const citations = sanitiseCitations(parsedWaiterOutput.citations, disclaimers);

  const disclaimerList = Array.from(disclaimers);
  const responseMetadata = metadataCollector.build();

  const waiterCostUsd = await logAgentEvent({
    agentType: 'waiter',
    context,
    sessionId,
    input: body.message,
    output: parsedWaiterOutput.reply,
    toolsUsed: ['get_menu', 'create_order', 'get_kitchen_load', 'check_allergens'],
    startedAt: waiterRunStarted,
    model: defaultModel,
    usage: waiterUsage,
    payload: {
      disclaimers: disclaimerList,
      citations,
      metadata: responseMetadata,
      suggested_prompts: waiterSuggestedPrompts,
      upsell: safeContextSuggestions,
    },
  });

  totalCostUsd += waiterCostUsd;

  return reply.send({
    session_id: sessionId,
    reply: parsedWaiterOutput.reply,
    upsell: safeContextSuggestions,
    disclaimers: disclaimerList,
    citations,
    cost_usd: Number(totalCostUsd.toFixed(6)),
    metadata: responseMetadata
  });
});

app.post('/agents/promo', async (request, reply) => {
  const parseResult = PromoRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'invalid_request', details: parseResult.error.issues });
  }

  const body = parseResult.data;

  const context = await buildAgentContext({
    tenantId: body.tenant_id,
    locationId: body.location_id,
    language: body.language,
  });

  const { sessionId, output, costUsd, metadata } = await executeManagedAgentRun({
    agentType: 'promo',
    agent: promoAgent,
    message: body.message,
    context,
    toolsUsed: ['list_promotions', 'update_promo_status'],
    schema: PromoAgentOutputSchema,
    sessionId: body.session_id ?? undefined,
    model: defaultModel,
    fallbackSuggestedPrompts: [
      'Show current promotion performance',
      'Recommend a budget adjustment',
      'Pause underperforming campaigns'
    ]
  });

  return reply.send({
    session_id: sessionId,
    actions: output.actions,
    notes: output.notes ?? [],
    cost_usd: Number(costUsd.toFixed(6)),
    metadata
  });
});

app.post('/agents/inventory', async (request, reply) => {
  const parseResult = InventoryRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'invalid_request', details: parseResult.error.issues });
  }

  const body = parseResult.data;

  const context = await buildAgentContext({
    tenantId: body.tenant_id,
    locationId: body.location_id,
    language: body.language,
  });

  const { sessionId, output, costUsd, metadata } = await executeManagedAgentRun({
    agentType: 'inventory',
    agent: inventoryAgent,
    message: body.message,
    context,
    toolsUsed: ['get_inventory_levels', 'adjust_inventory_level'],
    schema: InventoryAgentOutputSchema,
    sessionId: body.session_id ?? undefined,
    model: lowCostModel,
    fallbackSuggestedPrompts: [
      'Show items at risk of 86',
      'Propose substitutions for low stock items',
      'Draft an inventory adjustment summary'
    ]
  });

  return reply.send({
    session_id: sessionId,
    directives: output.directives,
    alerts: output.alerts ?? [],
    cost_usd: Number(costUsd.toFixed(6)),
    metadata
  });
});

app.post('/agents/support', async (request, reply) => {
  const parseResult = SupportRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'invalid_request', details: parseResult.error.issues });
  }

  const body = parseResult.data;
  if (!body.location_id && !body.table_session_id) {
    return reply.status(400).send({
      error: 'invalid_request',
      details: [{ message: 'location_id or table_session_id is required' }],
    });
  }

  const enrichedMessage = body.priority
    ? `[Priority: ${body.priority}] ${body.message}`
    : body.message;

  const context = await buildAgentContext({
    tenantId: body.tenant_id,
    locationId: body.location_id,
    tableSessionId: body.table_session_id,
    language: body.language,
  });

  const { sessionId, output, costUsd, metadata } = await executeManagedAgentRun({
    agentType: 'support',
    agent: supportAgent,
    message: enrichedMessage,
    context,
    toolsUsed: ['log_support_ticket'],
    schema: SupportAgentOutputSchema,
    sessionId: body.session_id ?? undefined,
    model: lowCostModel,
    fallbackSuggestedPrompts: [
      'Escalate this issue to a manager',
      'Schedule a follow-up with the guest',
      'Summarise open support tickets'
    ]
  });

  return reply.send({
    session_id: sessionId,
    ticket: output.ticket,
    summary: output.summary,
    next_steps: output.next_steps,
    cost_usd: Number(costUsd.toFixed(6)),
    metadata
  });
});

app.post('/agents/compliance', async (request, reply) => {
  const parseResult = ComplianceRequestSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'invalid_request', details: parseResult.error.issues });
  }

  const body = parseResult.data;

  const context = await buildAgentContext({
    tenantId: body.tenant_id,
    locationId: body.location_id,
    language: body.language,
  });

  const { sessionId, output, costUsd, metadata } = await executeManagedAgentRun({
    agentType: 'compliance',
    agent: complianceAgent,
    message: body.message,
    context,
    toolsUsed: ['resolve_compliance_task'],
    schema: ComplianceAgentOutputSchema,
    sessionId: body.session_id ?? undefined,
    model: lowCostModel,
    fallbackSuggestedPrompts: [
      'List outstanding compliance tasks',
      'Prepare an escalation summary',
      'Review recently resolved compliance items'
    ]
  });

  return reply.send({
    session_id: sessionId,
    tasks: output.tasks,
    escalation_required: output.escalation_required,
    cost_usd: Number(costUsd.toFixed(6)),
    metadata
  });
});

app.post('/agent-feedback', async (request, reply) => {
  const parseResult = AgentFeedbackSchema.safeParse(request.body);
  if (!parseResult.success) {
    return reply.status(400).send({ error: 'invalid_request', details: parseResult.error.issues });
  }

  const body = parseResult.data;

  await recordAgentFeedback({
    agentType: body.agent_type,
    sessionId: body.session_id,
    rating: body.rating,
    messageId: body.message_id,
    tenantId: body.tenant_id,
    locationId: body.location_id,
    tableSessionId: body.table_session_id,
  });

  return reply.status(204).send();
});

const gracefulShutdown = async () => {
  app.log.info('Shutting down agents service');
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const start = async () => {
  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info({ host: config.host, port: config.port, region: config.region }, 'Agents service ready');
  } catch (error) {
    app.log.error(error, 'Unable to start agents service');
    process.exit(1);
  }
};

start();
