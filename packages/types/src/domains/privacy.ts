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
