import { z } from 'zod';
import {
  AllergenGuardianOutputSchema,
  CartItemSchema,
  ComplianceAgentOutputSchema,
  InventoryAgentOutputSchema,
  PromoAgentOutputSchema,
  SupportAgentOutputSchema,
  UpsellOutputSchema,
  WaiterOutputSchema,
} from '../agents/types';

export const WaiterRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  table_session_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  language: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  cart: z.array(CartItemSchema).optional(),
  age_verified: z.boolean().optional(),
});

export type WaiterRequest = z.infer<typeof WaiterRequestSchema>;

export const PromoRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  tenant_id: z.string().uuid(),
  location_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  language: z.string().optional(),
});

export const InventoryRequestSchema = PromoRequestSchema;

export const SupportRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  tenant_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  table_session_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  session_id: z.string().uuid().optional(),
  language: z.string().optional(),
});

export const ComplianceRequestSchema = z.object({
  message: z.string().min(1, 'message is required'),
  tenant_id: z.string().uuid(),
  location_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  language: z.string().optional(),
});

export const AgentFeedbackSchema = z.object({
  session_id: z.string().uuid(),
  agent_type: z.string().min(1, 'agent_type is required'),
  rating: z.enum(['up', 'down']),
  message_id: z.string().optional(),
  tenant_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional(),
  table_session_id: z.string().uuid().optional(),
});

export function ensureLocationOrSession(body: WaiterRequest) {
  if (!body.location_id && !body.table_session_id) {
    throw new Error('Either location_id or table_session_id must be provided.');
  }
}
