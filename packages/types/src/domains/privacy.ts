import { z } from "zod";

export const PrivacyRequestInput = z.object({
  kind: z.enum(["export", "erasure"]),
  subject_user_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type PrivacyRequestInput = z.infer<typeof PrivacyRequestInput>;

export const PrivacyReviewInput = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

export type PrivacyReviewInput = z.infer<typeof PrivacyReviewInput>;

export const PrivacyExportInput = z.object({
  request_id: z.string().uuid(),
});

export type PrivacyExportInput = z.infer<typeof PrivacyExportInput>;

export const PrivacyErasurePlanInput = z.object({
  request_id: z.string().uuid(),
});

export type PrivacyErasurePlanInput = z.infer<typeof PrivacyErasurePlanInput>;

export const PrivacyErasureExecuteInput = z.object({
  request_id: z.string().uuid(),
  confirm: z.literal("ERASE"),
});

export type PrivacyErasureExecuteInput = z.infer<typeof PrivacyErasureExecuteInput>;

export const PIIFindingType = z.enum(["email", "phone", "id", "payment", "note"]);

export const PIIFinding = z.object({
  type: PIIFindingType,
  value: z.string(),
  index: z.number().int().nonnegative().optional(),
  context: z.string().optional(),
});

export const PIIScanInput = z.object({
  label: z.string().min(1).max(120).optional(),
  content: z.string().min(1).max(4000),
});

export const PIIScanResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  findings: z.array(PIIFinding),
  risk_score: z.number().min(0).max(1).optional(),
  summary: z.string().optional(),
  label: z.string().optional(),
});

export type PIIScanInput = z.infer<typeof PIIScanInput>;
export type PIIScanResponse = z.infer<typeof PIIScanResponse>;
export type PIIFinding = z.infer<typeof PIIFinding>;
