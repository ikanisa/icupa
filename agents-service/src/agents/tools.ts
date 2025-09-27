import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AnySupabaseClient } from '../supabase';
import type { AgentSessionContext, UpsellSuggestion } from './types';
import { CartItemSchema } from './types';

const GoalsSchema = z.array(z.enum(['pair', 'upsell', 'dessert', 'drink'])).default(['upsell']);

function assertToolAllowed(context: AgentSessionContext, toolName: string) {
  const agentType = context.activeAgentType;
  if (!agentType) return;
  const overrides = context.runtimeOverrides?.[agentType];
  if (!overrides) return;
  if (!overrides.toolAllowlist || overrides.toolAllowlist.length === 0) return;
  if (overrides.toolAllowlist.includes(toolName)) return;
  throw new Error(`Tool ${toolName} is disabled for agent ${agentType}.`);
}

function getContext(runContext: { context: AgentSessionContext }): AgentSessionContext {
  if (!runContext?.context) {
    throw new Error('Agent context is missing');
  }
  return runContext.context;
}

function pickTopSuggestions(context: AgentSessionContext, limit: number, goals: string[]): UpsellSuggestion[] {
  const avoidAlcohol = context.avoidAlcohol;
  const allergies = new Set(context.allergies.map((a) => a.toLowerCase()));
  const cartItemIds = new Set(context.cart.map((item) => item.item_id));

  const scored = context.menu
    .filter((item) => item.is_available)
    .filter((item) => !cartItemIds.has(item.id))
    .filter((item) => {
      if (avoidAlcohol && item.is_alcohol) return false;
      return item.allergens.every((tag) => !allergies.has(tag.toLowerCase()));
    })
    .map((item) => {
      let score = item.price_cents / 100; // prefer higher value items

      if (item.tags.some((tag) => ['dessert', 'sweet'].includes(tag.toLowerCase()))) {
        score += goals.includes('dessert') ? 8 : 3;
      }

      if (item.tags.some((tag) => ['drink', 'beverage', 'cocktail'].includes(tag.toLowerCase()))) {
        score += goals.includes('drink') ? 8 : 2;
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
            (item.tags.length > 0 ? `Highlighted because it features ${item.tags.join(', ')}.` : 'Guest favourite add-on.'),
          allergens: item.allergens,
          tags: item.tags,
          is_alcohol: item.is_alcohol,
          citations: [`menu:${item.id}`]
        } satisfies UpsellSuggestion
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.suggestion);
}

export function createAgentTools(deps: { supabase: AnySupabaseClient }) {
  const getMenu = tool({
    name: 'get_menu',
    description: 'List available menu items for the active location including allergens and pricing.',
    parameters: z.object({
      limit: z.number().int().min(1).max(100).optional().default(40)
    }),
    async execute(input, runContext) {
      const context = getContext(runContext);
      assertToolAllowed(context, 'get_menu');
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
        citation: `menu:${item.id}`
      }));

      return { items };
    }
  });

  const checkAllergens = tool({
    name: 'check_allergens',
    description: 'Verify whether the provided items conflict with the declared allergen list.',
    parameters: z.object({
      item_ids: z.array(z.string().uuid()),
      explicit_allergens: z.array(z.string()).optional()
    }),
    async execute(input, runContext) {
      const context = getContext(runContext);
      assertToolAllowed(context, 'check_allergens');
      const allergens = new Set(
        (input.explicit_allergens ?? context.allergies).map((allergen) => allergen.toLowerCase())
      );

      const menuIndex = new Map(context.menu.map((item) => [item.id, item]));

      const conflicts = [] as { item_id: string; allergens: string[] }[];
      const safe = [] as { item_id: string }[];

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
    }
  });

  const recommendItems = tool({
    name: 'recommend_items',
    description:
      'Return 2-3 upsell suggestions that fit the guests context. Avoid allergens and age-restricted items when disallowed.',
    parameters: z.object({
      goals: GoalsSchema.optional(),
      limit: z.number().int().min(1).max(3).optional().default(3)
    }),
    async execute(input, runContext) {
      const context = getContext(runContext);
      assertToolAllowed(context, 'recommend_items');
      const goals = input.goals ?? ['upsell'];
      const limit = input.limit ?? 3;

      const suggestions = pickTopSuggestions(context, limit, goals);

      return {
        suggestions,
        source: 'menu',
        generated_at: new Date().toISOString()
      };
    }
  });

  const createOrder = tool({
    name: 'create_order',
    description:
      'Record a draft order proposal for staff review. This does not charge the guest and is used for one-tap approvals.',
    parameters: z.object({
      cart: z.array(CartItemSchema),
      notes: z.string().optional()
    }),
    async execute(input, runContext) {
      const context = getContext(runContext);
      assertToolAllowed(context, 'create_order');
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
          language: context.language
        }
      };

      await deps.supabase.from('events').insert({
        tenant_id: payload.tenant_id,
        location_id: payload.location_id,
        table_session_id: payload.table_session_id,
        type: 'agent_order_proposal',
        payload: payload.payload
      });

      return { status: 'recorded', proposal_ref: context.sessionId };
    }
  });

  const getKitchenLoad = tool({
    name: 'get_kitchen_load',
    description: 'Return a lightweight snapshot of kitchen backlog based on open orders for the active location.',
    parameters: z.object({}),
    async execute(_, runContext) {
      const context = getContext(runContext);
      assertToolAllowed(context, 'get_kitchen_load');
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
        open_orders: waits.length
      };
    }
  });

  return {
    getMenu,
    checkAllergens,
    recommendItems,
    createOrder,
    getKitchenLoad
  };
}
