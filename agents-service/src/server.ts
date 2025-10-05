import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';
import { loadConfig } from './config';
import { upsellAgent, allergenGuardianAgent, waiterAgent, runner, applyAllergenFilter } from './agents/agents';
import { buildAgentContext, updateRetrievalCacheTtl } from './services/context';
import {
  ensureAgentEnabled,
  assertBudgetsAfterRun,
  createAgentSessionRecord,
  logAgentEvent,
  recordRecommendationImpressions
} from './services/telemetry';
import type { AgentSessionContext, UpsellSuggestion } from './agents/types';
import type { RuntimeConfig } from './services/telemetry';
import { CartItemSchema, WaiterOutputSchema, UpsellOutputSchema, AllergenGuardianOutputSchema } from './agents/types';
import { estimateCostUsd } from './utils/pricing';

const config = loadConfig();

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

const WaiterRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  table_session_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  language: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  cart: z.array(CartItemSchema).optional(),
  age_verified: z.boolean().optional()
});

type WaiterRequest = z.infer<typeof WaiterRequestSchema>;

function ensureLocationOrSession(body: WaiterRequest) {
  if (!body.location_id && !body.table_session_id) {
    throw new Error('Either location_id or table_session_id must be provided.');
  }
}

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

function applyRuntimeOverrides(
  agentType: string,
  runtime: RuntimeConfig,
  context: AgentSessionContext
) {
  context.runtimeOverrides[agentType] = {
    instructions: runtime.instructions,
    toolAllowlist: runtime.toolAllowlist,
    autonomyLevel: runtime.autonomyLevel,
    retrievalTtlMinutes: runtime.retrievalTtlMinutes,
    experimentFlag: runtime.experimentFlag
  };
  updateRetrievalCacheTtl(context, runtime.retrievalTtlMinutes);
}

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

  const waiterRuntime = await ensureAgentEnabled('waiter', context.tenantId);
  applyRuntimeOverrides('waiter', waiterRuntime, context);

  const sessionId =
    body.session_id ?? (await createAgentSessionRecord('waiter', context, waiterRuntime));
  context.sessionId = sessionId;

  const disclaimers = new Set<string>();
  let totalCostUsd = 0;

  const upsellRunStarted = Date.now();
  let upsellUsage = { inputTokens: 0, outputTokens: 0 };
  context.activeAgentType = 'upsell';
  try {
    const upsellRuntime = await ensureAgentEnabled('upsell', context.tenantId);
    applyRuntimeOverrides('upsell', upsellRuntime, context);
    const upsellResult = await runner.run(upsellAgent, body.message, { context });
    upsellUsage = extractUsage(upsellResult);
    const upsellOutput = UpsellOutputSchema.parse(upsellResult.finalOutput ?? { suggestions: [] });
    context.suggestions = upsellOutput.suggestions as UpsellSuggestion[];

    const upsellCostEstimate = estimateCostUsd(config.openai.defaultModel, upsellUsage);
    await assertBudgetsAfterRun('upsell', context.tenantId, upsellRuntime, upsellCostEstimate);

    const upsellCostUsd = await logAgentEvent({
      agentType: 'upsell',
      context,
      sessionId,
      input: body.message,
      output: summariseSuggestionsForTelemetry(context.suggestions),
      toolsUsed: ['get_menu', 'recommend_items', 'check_allergens', 'get_kitchen_load'],
      startedAt: upsellRunStarted,
      model: config.openai.defaultModel,
      usage: upsellUsage
    });

    totalCostUsd += upsellCostUsd;
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
      model: config.openai.defaultModel
    });
  } finally {
    context.activeAgentType = undefined;
  }

  let guardianUsage = { inputTokens: 0, outputTokens: 0 };
  if (context.suggestions.length > 0) {
    context.activeAgentType = 'allergen_guardian';
    const guardianRunStarted = Date.now();
    const guardianRuntime = await ensureAgentEnabled('allergen_guardian', context.tenantId);
    applyRuntimeOverrides('allergen_guardian', guardianRuntime, context);
    let guardianResult;
    try {
      guardianResult = await runner.run(
        allergenGuardianAgent,
        JSON.stringify({ suggestions: context.suggestions }),
        { context }
      );
    } finally {
      context.activeAgentType = undefined;
    }
    guardianUsage = extractUsage(guardianResult);
    const guardianOutput = AllergenGuardianOutputSchema.parse(guardianResult.finalOutput ?? {});

    const blockedDisclaimers = buildDisclaimers(context, guardianOutput.blocked ?? []);
    blockedDisclaimers.forEach((message) => addDisclaimer(disclaimers, message));

    const filtered = applyAllergenFilter(context.suggestions, guardianOutput);
    if (filtered.length === 0) {
      addDisclaimer(disclaimers, 'All upsell suggestions were removed because of allergen or policy conflicts.');
    }
    context.suggestions = filtered;

    const guardianCostEstimate = estimateCostUsd(config.openai.defaultModel, guardianUsage);
    await assertBudgetsAfterRun('allergen_guardian', context.tenantId, guardianRuntime, guardianCostEstimate);

    const guardianCostUsd = await logAgentEvent({
      agentType: 'allergen_guardian',
      context,
      sessionId,
      input: JSON.stringify({ suggestions: context.suggestions }),
      output: summariseBlockedSuggestions(guardianOutput.blocked ?? [], context),
      toolsUsed: ['check_allergens'],
      startedAt: guardianRunStarted,
      model: config.openai.defaultModel,
      usage: guardianUsage
    });

    totalCostUsd += guardianCostUsd;
  }

  context.suggestions = await recordRecommendationImpressions(context, sessionId, context.suggestions);

  const waiterRunStarted = Date.now();
  context.activeAgentType = 'waiter';
  let waiterResult;
  try {
    waiterResult = await runner.run(waiterAgent, body.message, { context });
  } finally {
    context.activeAgentType = undefined;
  }
  const waiterUsage = extractUsage(waiterResult);
  const waiterOutput = waiterResult.finalOutput;
  if (!waiterOutput) {
    throw new Error('Waiter agent did not produce a response.');
  }
  const parsedWaiterOutput = WaiterOutputSchema.parse(waiterOutput);

  const waiterCostEstimate = estimateCostUsd(config.openai.defaultModel, waiterUsage);
  await assertBudgetsAfterRun('waiter', context.tenantId, waiterRuntime, waiterCostEstimate);

  const waiterCostUsd = await logAgentEvent({
    agentType: 'waiter',
    context,
    sessionId,
    input: body.message,
    output: parsedWaiterOutput.reply,
    toolsUsed: ['get_menu', 'create_order', 'get_kitchen_load', 'check_allergens'],
    startedAt: waiterRunStarted,
    model: config.openai.defaultModel,
    usage: waiterUsage
  });

  totalCostUsd += waiterCostUsd;

  const invalidUpsell = (parsedWaiterOutput.upsell ?? []).filter(
    (suggestion) => !context.suggestions.some((item) => item.item_id === suggestion.item_id)
  );
  if (invalidUpsell.length) {
    addDisclaimer(disclaimers, 'Some model suggestions were removed because they bypassed safety checks.');
  }

  (parsedWaiterOutput.disclaimers ?? []).forEach((message) => addDisclaimer(disclaimers, message));

  const citations = sanitiseCitations(parsedWaiterOutput.citations, disclaimers);

  return reply.send({
    session_id: sessionId,
    reply: parsedWaiterOutput.reply,
    upsell: context.suggestions,
    disclaimers: Array.from(disclaimers),
    citations,
    cost_usd: Number(totalCostUsd.toFixed(6))
  });
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
