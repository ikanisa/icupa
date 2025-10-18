import { z } from "zod";

export const InventorySearchInput = z.object({
  destination: z.string().min(2, "destination_required"),
  startDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  endDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  party: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0).default(0),
  }),
  budgetHint: z.enum(["value", "balanced", "premium"]).optional(),
  locale: z.enum(["en", "rw"]).default("en"),
});

export type InventorySearchInput = z.infer<typeof InventorySearchInput>;

export const CheckoutInput = z.object({
  itineraryId: z.string().uuid("invalid_itinerary_id"),
  quoteId: z.string().min(1),
  amountCents: z.number().int().min(0),
  currency: z.string().length(3),
  paymentProvider: z.enum(["stripe", "momo", "revolut"]),
  idempotencyKey: z.string().min(10),
});

export type CheckoutInput = z.infer<typeof CheckoutInput>;

export const PermitRequest = z.object({
  park: z.string().min(2),
  visitDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  pax: z.number().int().min(1),
  contactEmail: z.string().email(),
  phone: z.string().min(7),
  notes: z.string().max(500).optional(),
});

export type PermitRequest = z.infer<typeof PermitRequest>;

export const EscrowCreate = z.object({
  name: z.string().min(3),
  targetAmountCents: z.number().int().min(1000),
  currency: z.string().length(3),
  deadline: z.string().refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  itineraryId: z.string().uuid(),
});

export type EscrowCreate = z.infer<typeof EscrowCreate>;

export const ContributionCreate = z.object({
  escrowId: z.string().uuid(),
  amountCents: z.number().int().min(1000),
  currency: z.string().length(3),
  contributorName: z.string().min(2),
  idempotencyKey: z.string().min(10),
});

export type ContributionCreate = z.infer<typeof ContributionCreate>;

export const GroupsPayoutReportQuery = z
  .object({
    from: z.string().min(4).optional(),
    to: z.string().min(4).optional(),
  })
  .partial();

export type GroupsPayoutReportQuery = z.infer<typeof GroupsPayoutReportQuery>;

export const GroupsOpsPayoutNowInput = z.object({
  escrow_id: z.string().uuid(),
});

export type GroupsOpsPayoutNowInput = z.infer<typeof GroupsOpsPayoutNowInput>;

export const InvoiceGenerateInput = z.object({
  kind: z.enum(["invoice", "credit_note"]),
  payment_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
});

export type InvoiceGenerateInput = z.infer<typeof InvoiceGenerateInput>;

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

export const DrSnapshotInput = z.object({
  label: z.string().min(3),
  tables: z.array(z.string().min(1)).min(1).optional(),
});

export type DrSnapshotInput = z.infer<typeof DrSnapshotInput>;
