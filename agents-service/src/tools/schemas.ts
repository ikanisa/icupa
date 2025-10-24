import { z } from 'zod';
import { CartItemSchema, UpsellListSchema } from '../agents/types';

export const GetMenuInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const CheckAllergensInputSchema = z.object({
  item_ids: z.array(z.string().uuid()),
  explicit_allergens: z.array(z.string()).optional(),
});

export const RecommendItemsInputSchema = z
  .object({
    goals: z
      .array(z.enum(['pair', 'upsell', 'dessert', 'drink', 'non_alcoholic']))
      .min(1)
      .max(10)
      .optional(),
    limit: z.number().int().min(1).max(3).optional(),
  })
  .strict();

export const RecommendItemsOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      item_id: z.string().uuid(),
      name: z.string(),
      price_cents: z.number().int().nonnegative(),
      currency: z.string(),
      rationale: z.string(),
      allergens: z.array(z.string()),
      tags: z.array(z.string()),
      is_alcohol: z.boolean(),
      citations: z.array(z.string()),
    })
  ),
  source: z.literal('menu'),
  generated_at: z.string(),
});

export const CreateOrderInputSchema = z.object({
  cart: z.array(CartItemSchema),
  notes: z.string().optional(),
});

export const CreateOrderOutputSchema = z.object({
  status: z.literal('recorded'),
  proposal_ref: z.string(),
});

export const KitchenLoadInputSchema = z.object({}).strict();
