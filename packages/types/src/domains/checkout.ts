import { z } from "zod";

import { CurrencyCode } from "./shared";

export const CheckoutInput = z.object({
  itineraryId: z.string().uuid("invalid_itinerary_id"),
  quoteId: z.string().min(1),
  amountCents: z.number().int().min(0),
  currency: CurrencyCode,
  paymentProvider: z.enum(["stripe", "momo", "revolut"]),
  idempotencyKey: z.string().min(10),
});

export type CheckoutInput = z.infer<typeof CheckoutInput>;

export const PaymentEscalationAction = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  cta_label: z.string(),
  cta_type: z.enum(["retry_intent", "open_url", "contact_ops", "copy_text"]),
  idempotency_hint: z.string().optional(),
  wait_seconds: z.number().int().positive().optional(),
  href: z.string().optional(),
  contact_channel: z.string().optional(),
  text: z.string().optional(),
});

export type PaymentEscalationAction = z.infer<typeof PaymentEscalationAction>;

export const PaymentEscalationHealthCheck = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  detail: z.string(),
  last_checked: z.string().optional(),
});

export type PaymentEscalationHealthCheck = z.infer<typeof PaymentEscalationHealthCheck>;

export const PaymentEscalationResponse = z.object({
  ok: z.literal(true),
  request_id: z.string(),
  headline: z.string(),
  summary: z.string(),
  failure_code: z.string(),
  itinerary_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
  idempotency_key: z.string(),
  next_actions: z.array(PaymentEscalationAction),
  health_checks: z.array(PaymentEscalationHealthCheck),
  source: z.string(),
});

export type PaymentEscalationResponse = z.infer<typeof PaymentEscalationResponse>;

export const PaymentEscalationInput = z.object({
  itineraryId: z.string().uuid(),
  paymentId: z.string().uuid().optional(),
  failureCode: z.string().min(1),
  idempotencyKey: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: CurrencyCode,
});

export type PaymentEscalationInput = z.infer<typeof PaymentEscalationInput>;
