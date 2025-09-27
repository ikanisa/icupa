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
  rationale: z.string(),
  allergens: z.array(z.string()),
  tags: z.array(z.string()),
  is_alcohol: z.boolean(),
  citations: z.array(z.string())
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
        reason: z.string()
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
    .default([])
});

export type AllergenGuardianOutput = z.infer<typeof AllergenGuardianOutputSchema>;

export const WaiterOutputSchema = z.object({
  reply: z.string(),
  upsell: UpsellListSchema.optional().default([]),
  disclaimers: z.array(z.string()).optional(),
  citations: z.array(z.string()).min(1)
});

export type WaiterOutput = z.infer<typeof WaiterOutputSchema>;
