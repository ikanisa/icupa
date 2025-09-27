import { z } from 'zod';

export const CartItemSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1)
});

export type CartItem = z.infer<typeof CartItemSchema>;

export interface MenuItemSummary {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  allergens: string[];
  tags: string[];
  is_alcohol: boolean;
  is_available: boolean;
  menu_id: string;
}

export interface AgentSessionContext {
  sessionId: string;
  tenantId?: string;
  locationId?: string;
  tableSessionId?: string;
  userId?: string;
  region: 'EU' | 'RW';
  language: string;
  allergies: string[];
  avoidAlcohol: boolean;
  legalDrinkingAge: number;
  menu: MenuItemSummary[];
  cart: CartItem[];
  kitchenBacklogMinutes?: number;
  retrievalCache: Map<string, { expiresAt: number; payload: string }>; // keyed by collection
  suggestions?: UpsellSuggestion[];
}

export type UpsellSuggestion = z.infer<typeof UpsellSuggestionSchema>;

const UpsellSuggestionSchema = z.object({
  item_id: z.string().uuid(),
  name: z.string(),
  price_cents: z.number().int().nonnegative(),
  currency: z.string(),
  rationale: z.string().min(1, 'rationale required'),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
  is_alcohol: z.boolean(),
  citations: z.array(z.string()).min(1, 'citation token required')
});

export const UpsellListSchema = z.array(UpsellSuggestionSchema).max(3);

export const UpsellOutputSchema = z.object({
  suggestions: UpsellListSchema
});

export type UpsellAgentOutput = z.infer<typeof UpsellOutputSchema>;

export const AllergenGuardianOutputSchema = z.object({
  blocked: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        allergens: z.array(z.string()),
        reason: z.string().min(1, 'reason required')
      })
    )
    .default([]),
  safe: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        rationale: z.string().optional()
      })
    )
    .default([]),
  notes: z.array(z.string()).optional().default([])
});

export type AllergenGuardianOutput = z.infer<typeof AllergenGuardianOutputSchema>;

export const WaiterOutputSchema = z.object({
  reply: z.string().min(1, 'reply is required'),
  upsell: UpsellListSchema.optional().default([]),
  disclaimers: z.array(z.string()).optional().default([]),
  citations: z.array(z.string()).min(1, 'at least one citation required'),
  metadata: z
    .object({
      tool_calls: z.array(z.string()).optional(),
      locale: z.string().optional(),
    })
    .optional()
    .default({}),
});

export type WaiterOutput = z.infer<typeof WaiterOutputSchema>;

export const PromoActionSchema = z.object({
  campaign_id: z.string().uuid(),
  action: z.enum(["activate", "pause", "archive", "adjust_budget"]),
  rationale: z.string(),
  budget_delta_cents: z.number().int().optional(),
});

export const PromoAgentOutputSchema = z.object({
  actions: z.array(PromoActionSchema),
  notes: z.array(z.string()).optional(),
});

export type PromoAgentOutput = z.infer<typeof PromoAgentOutputSchema>;

export const InventoryDirectiveSchema = z.object({
  inventory_id: z.string().uuid(),
  new_quantity: z.number().nonnegative(),
  auto_86: z.boolean().optional(),
  rationale: z.string(),
});

export const InventoryAgentOutputSchema = z.object({
  directives: z.array(InventoryDirectiveSchema),
  alerts: z.array(z.string()).optional(),
});

export type InventoryAgentOutput = z.infer<typeof InventoryAgentOutputSchema>;

export const SupportAgentOutputSchema = z.object({
  summary: z.string(),
  ticket: z.object({
    id: z.string().uuid(),
    priority: z.enum(["low", "medium", "high"]),
    recommended_channel: z.enum(["email", "sms", "push", "phone"]),
  }),
  next_steps: z.array(z.string()),
});

export type SupportAgentOutput = z.infer<typeof SupportAgentOutputSchema>;

export const ComplianceAgentOutputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["resolved", "blocked", "escalate"]),
      notes: z.string(),
    })
  ),
  escalation_required: z.boolean().default(false),
});

export type ComplianceAgentOutput = z.infer<typeof ComplianceAgentOutputSchema>;
