import { z } from "zod";

export const InvoiceGenerateInput = z.object({
  kind: z.enum(["invoice", "credit_note"]),
  payment_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
});

export type InvoiceGenerateInput = z.infer<typeof InvoiceGenerateInput>;

export const RefundPolicyRiskLevel = z.enum(["low", "medium", "high"]);

export const RefundPolicyHighlight = z.object({
  text: z.string(),
  risk: RefundPolicyRiskLevel.optional(),
});

export const RefundPolicySummary = z.object({
  title: z.string().default("Refund policy assessment"),
  risk_grade: RefundPolicyRiskLevel,
  context: z.string().optional(),
  highlights: z.array(RefundPolicyHighlight).default([]),
  actions: z.array(z.string()).default([]),
  generated_at: z.string(),
});

export const RefundPolicySummarizeInput = z.object({
  itinerary_id: z.string().uuid(),
  policy_text: z.string().min(1).max(4000).optional(),
});

export const RefundPolicySummarizeResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  summary: RefundPolicySummary.optional(),
});

export type RefundPolicySummary = z.infer<typeof RefundPolicySummary>;
export type RefundPolicyHighlight = z.infer<typeof RefundPolicyHighlight>;
export type RefundPolicySummarizeInput = z.infer<typeof RefundPolicySummarizeInput>;
export type RefundPolicySummarizeResponse = z.infer<typeof RefundPolicySummarizeResponse>;
