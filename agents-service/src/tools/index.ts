import { randomUUID } from 'crypto';
import { RunContext, tool } from '@openai/agents';
import { z } from 'zod';
import type { AnySupabaseClient } from '../supabase';
import type { AgentSessionContext, UpsellSuggestion } from '../agents/types';
import {
  GetMenuInputSchema,
  CheckAllergensInputSchema,
  RecommendItemsInputSchema,
  RecommendItemsOutputSchema,
  CreateOrderInputSchema,
  CreateOrderOutputSchema,
  KitchenLoadInputSchema,
} from './schemas';

function assertContext(
  runContext?: RunContext<AgentSessionContext>
): AgentSessionContext {
  if (!runContext?.context) {
    throw new Error('Agent context is missing');
  }
  return runContext.context;
}

function scoreMenuSuggestions(
  context: AgentSessionContext,
  limit: number,
  goals: string[]
): UpsellSuggestion[] {
  const avoidAlcohol = context.avoidAlcohol;
  const allergies = new Set(context.allergies.map((value) => value.toLowerCase()));
  const cartItemIds = new Set(context.cart.map((item) => item.item_id));

  const scored = context.menu
    .filter((item) => item.is_available)
    .filter((item) => !cartItemIds.has(item.id))
    .filter((item) => {
      if (avoidAlcohol && item.is_alcohol) return false;
      return item.allergens.every((tag) => !allergies.has(tag.toLowerCase()));
    })
    .map((item) => {
      let score = item.price_cents / 100;

      if (item.tags.some((tag) => ['dessert', 'sweet'].includes(tag.toLowerCase()))) {
        score += goals.includes('dessert') ? 8 : 3;
      }

      if (item.tags.some((tag) => ['drink', 'beverage', 'cocktail'].includes(tag.toLowerCase()))) {
        score += goals.includes('drink') ? 8 : 2;
      }

      if (item.tags.some((tag) => ['non_alcoholic', 'mocktail'].includes(tag.toLowerCase()))) {
        score += goals.includes('non_alcoholic') ? 7 : 1;
      }

      if (item.tags.some((tag) => ['shareable', 'small_plate'].includes(tag.toLowerCase()))) {
        score += 2;
      }

      if (item.tags.some((tag) => ['signature', 'best_seller'].includes(tag.toLowerCase()))) {
        score += 6;
      }

      if (item.tags.some((tag) => ['vegan', 'vegetarian'].includes(tag.toLowerCase()))) {
        score += goals.includes('pair') ? 1.5 : 0.5;
      }

      return {
        score,
        suggestion: {
          item_id: item.id,
          name: item.name,
          price_cents: item.price_cents,
          currency: item.currency,
          rationale:
            item.description?.slice(0, 180) ??
            (item.tags.length > 0
              ? `Highlighted because it features ${item.tags.join(', ')}.`
              : 'Guest favourite add-on.'),
          allergens: item.allergens,
          tags: item.tags,
          is_alcohol: item.is_alcohol,
          citations: [`menu:${item.id}`],
        },
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.suggestion);
}

export function createAgentTools(deps: { supabase: AnySupabaseClient }) {
  async function enqueueAgentAction(params: {
    context: AgentSessionContext;
    agentType: string;
    actionType: string;
    payload: Record<string, unknown>;
    rationale?: string;
  }) {
    const { data, error } = await deps.supabase
      .from('agent_action_queue')
      .insert({
        tenant_id: params.context.tenantId ?? null,
        location_id: params.context.locationId ?? null,
        agent_type: params.agentType,
        action_type: params.actionType,
        payload: params.payload,
        rationale: params.rationale ?? null,
        created_by: params.context.userId ?? null,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to enqueue ${params.actionType}: ${error.message}`);
    }

    return data?.id as string;
  }

  const getMenu = tool<typeof GetMenuInputSchema, AgentSessionContext>({
    name: 'get_menu',
    description: 'List available menu items for the active location including allergens and pricing.',
    parameters: GetMenuInputSchema,
    async execute(input, runContext?: RunContext<AgentSessionContext>) {
      const context = assertContext(runContext);
      const limit = input.limit ?? 40;

      const items = context.menu.slice(0, limit).map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price_cents: item.price_cents,
        currency: item.currency,
        allergens: item.allergens,
        tags: item.tags,
        is_alcohol: item.is_alcohol,
        citation: `menu:${item.id}`,
      }));

      return { items };
    },
  });

  const checkAllergens = tool<typeof CheckAllergensInputSchema, AgentSessionContext>({
    name: 'check_allergens',
    description: 'Verify whether the provided items conflict with the declared allergen list.',
    parameters: CheckAllergensInputSchema,
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      const allergens = new Set(
        (input.explicit_allergens ?? context.allergies).map((value) => value.toLowerCase())
      );
      const menuIndex = new Map(context.menu.map((item) => [item.id, item]));

      const conflicts: { item_id: string; allergens: string[] }[] = [];
      const safe: { item_id: string }[] = [];

      for (const id of input.item_ids) {
        const item = menuIndex.get(id);
        if (!item) continue;
        const overlapping = item.allergens.filter((tag) => allergens.has(tag.toLowerCase()));
        if (overlapping.length > 0) {
          conflicts.push({ item_id: id, allergens: overlapping });
        } else {
          safe.push({ item_id: id });
        }
      }

      return { conflicts, safe, citation: 'allergens:policy' };
    },
  });

  const recommendItems = tool<
    typeof RecommendItemsInputSchema,
    AgentSessionContext
  >({
    name: 'recommend_items',
    description:
      'Return 2-3 upsell suggestions that fit the guests context. Avoid allergens and age-restricted items when disallowed.',
    parameters: RecommendItemsInputSchema,
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      const goals = input.goals ?? ['upsell'];
      const limit = input.limit ?? 3;
      const suggestions = scoreMenuSuggestions(context, limit, goals);

      return RecommendItemsOutputSchema.parse({
        suggestions,
        source: 'menu',
        generated_at: new Date().toISOString(),
      });
    },
  });

  const createOrder = tool<typeof CreateOrderInputSchema, AgentSessionContext>({
    name: 'create_order',
    description:
      'Record a draft order proposal for staff review. This does not charge the guest and is used for one-tap approvals.',
    parameters: CreateOrderInputSchema,
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      if (!context.locationId || !context.tenantId) {
        throw new Error('Cannot create order proposal without tenant and location identifiers.');
      }

      const payload = {
        tenant_id: context.tenantId,
        location_id: context.locationId,
        table_session_id: context.tableSessionId ?? null,
        agent_type: 'waiter',
        payload: {
          cart: input.cart,
          notes: input.notes,
          session_id: context.sessionId,
          language: context.language,
        },
      };

      await deps.supabase.from('events').insert({
        tenant_id: payload.tenant_id,
        location_id: payload.location_id,
        table_session_id: payload.table_session_id,
        type: 'agent_order_proposal',
        payload: payload.payload,
      });

      return CreateOrderOutputSchema.parse({
        status: 'recorded',
        proposal_ref: context.sessionId,
      });
    },
  });

  const getKitchenLoad = tool<
    typeof KitchenLoadInputSchema,
    AgentSessionContext
  >({
    name: 'get_kitchen_load',
    description: 'Return a lightweight snapshot of kitchen backlog based on open orders for the active location.',
    parameters: KitchenLoadInputSchema,
    async execute(
      _input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      if (!context.locationId) {
        return { backlog_minutes: 0, open_orders: 0 };
      }

      const { data, error } = await deps.supabase
        .from('orders')
        .select('id, created_at')
        .eq('location_id', context.locationId)
        .in('status', ['submitted', 'in_kitchen']);

      if (error) {
        throw new Error(`Unable to fetch kitchen load: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return { backlog_minutes: 0, open_orders: 0 };
      }

      const now = Date.now();
      const waits = data
        .map((order) => {
          const created = new Date(order.created_at).getTime();
          return (now - created) / 60000;
        })
        .filter((value) => Number.isFinite(value) && value >= 0)
        .sort((a, b) => a - b);

      const index = Math.floor(waits.length * 0.9);
      const p90 = waits[Math.min(index, waits.length - 1)];
      return {
        backlog_minutes: Number(p90?.toFixed(2) ?? 0),
        open_orders: waits.length,
      };
    },
  });

  const listPromotions = tool({
    name: 'list_promotions',
    description: 'Fetch active promo campaigns for the tenant and location.',
    parameters: z.object({
      status: z
        .enum(['draft', 'pending_review', 'approved', 'active', 'paused', 'archived'])
        .optional(),
    }),
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      if (!context.tenantId) {
        throw new Error('Tenant context required to list promotions.');
      }

      let query = deps.supabase
        .from('promo_campaigns')
        .select('id, name, status, epsilon, budget_cap_cents, spent_cents, frequency_cap')
        .eq('tenant_id', context.tenantId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (input.status) {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Unable to load promotions: ${error.message}`);
      }

      return { campaigns: data ?? [], citation: 'policies:promotions' };
    },
  });

  const updatePromotion = tool({
    name: 'update_promo_status',
    description: 'Adjust promo campaign status or budget. Allowed statuses: active, paused, archived.',
    parameters: z.object({
      campaign_id: z.string().uuid(),
      status: z.enum(['active', 'paused', 'archived']).optional(),
      budget_delta_cents: z.number().int().optional(),
      rationale: z.string().optional(),
    }),
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      if (!context.tenantId) {
        throw new Error('Tenant context required to adjust promotions.');
      }

      const actionId = await enqueueAgentAction({
        context,
        agentType: 'promo',
        actionType: 'promo.update_campaign',
        payload: {
          campaign_id: input.campaign_id,
          status: input.status ?? null,
          budget_delta_cents: input.budget_delta_cents ?? null,
        },
        rationale: input.rationale,
      });

      return { status: 'queued', action_id: actionId };
    },
  });

  const getInventoryLevels = tool({
    name: 'get_inventory_levels',
    description: 'Fetch the lowest-stock inventory items for the current location.',
    parameters: z
      .object({
        limit: z.number().int().min(1).max(50).optional(),
      })
      .strict(),
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      const limit = input.limit ?? 25;
      if (!context.locationId) {
        throw new Error('Location context required to fetch inventory.');
      }

      const { data, error } = await deps.supabase
        .from('inventory_items')
        .select('id, display_name, quantity, par_level, auto_86, auto_86_level')
        .eq('location_id', context.locationId)
        .order('quantity', { ascending: true })
        .limit(limit);

      if (error) {
        throw new Error(`Unable to read inventory: ${error.message}`);
      }

      return { items: data ?? [], citation: 'inventory:snapshot' };
    },
  });

  const adjustInventoryLevel = tool({
    name: 'adjust_inventory_level',
    description: 'Queue an inventory adjustment for review.',
    parameters: z.object({
      inventory_id: z.string().uuid(),
      quantity: z.number().nonnegative().optional(),
      auto_86: z.boolean().optional(),
      auto_86_level: z.string().optional(),
    }),
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      if (!context.locationId) {
        throw new Error('Location context required to adjust inventory.');
      }

      const actionId = await enqueueAgentAction({
        context,
        agentType: 'inventory',
        actionType: 'inventory.adjust_level',
        payload: {
          inventory_id: input.inventory_id,
          quantity: input.quantity ?? null,
          auto_86: input.auto_86 ?? null,
          auto_86_level: input.auto_86_level ?? null,
        },
      });

      return { status: 'queued', action_id: actionId };
    },
  });

  const logSupportTicket = tool({
    name: 'log_support_ticket',
    description: 'Record a support ticket and return the generated identifier.',
    parameters: z.object({
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      summary: z.string(),
      details: z.string().optional(),
    }),
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      const ticketId = randomUUID();

      const { error } = await deps.supabase.from('events').insert({
        id: ticketId,
        tenant_id: context.tenantId ?? null,
        location_id: context.locationId ?? null,
        table_session_id: context.tableSessionId ?? null,
        type: 'support.ticket.opened',
        payload: {
          priority: input.priority,
          summary: input.summary,
          details: input.details ?? null,
        },
      });

      if (error) {
        throw new Error(`Failed to log support ticket: ${error.message}`);
      }

      return { ticket_id: ticketId };
    },
  });

  const resolveComplianceTask = tool({
    name: 'resolve_compliance_task',
    description: 'Update the status of a compliance task.',
    parameters: z.object({
      task_id: z.string().uuid(),
      status: z.enum(['pending', 'in_progress', 'blocked', 'resolved']),
      notes: z.string().optional(),
    }),
    async execute(
      input,
      runContext?: RunContext<AgentSessionContext>
    ) {
      const context = assertContext(runContext);
      if (!context.tenantId) {
        throw new Error('Tenant context required to update compliance tasks.');
      }

      const update: Record<string, unknown> = { status: input.status };
      if (input.notes) {
        update.details = { note: input.notes };
      }

      const { error } = await deps.supabase
        .from('compliance_tasks')
        .update(update)
        .eq('id', input.task_id)
        .eq('tenant_id', context.tenantId);

      if (error) {
        throw new Error(`Failed to update compliance task: ${error.message}`);
      }

      return { status: 'ok' };
    },
  });

  return {
    getMenu,
    checkAllergens,
    recommendItems,
    createOrder,
    getKitchenLoad,
    listPromotions,
    updatePromotion,
    getInventoryLevels,
    adjustInventoryLevel,
    logSupportTicket,
    resolveComplianceTask,
  };
}
