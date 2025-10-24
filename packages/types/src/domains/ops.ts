import { z } from "zod";

export const OpsBookingsQuery = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    supplier: z.string().optional(),
    page: z.number().int().positive().optional(),
    page_size: z.number().int().positive().max(100).optional(),
  })
  .partial();

export type OpsBookingsQuery = z.infer<typeof OpsBookingsQuery>;

export const OpsExceptionsQuery = z
  .object({
    status: z.string().optional(),
    page: z.number().int().positive().optional(),
    page_size: z.number().int().positive().max(100).optional(),
  })
  .partial();

export type OpsExceptionsQuery = z.infer<typeof OpsExceptionsQuery>;

export const SupplierSlaRiskLevel = z.enum(["breach", "warning", "on_track"]);

export type SupplierSlaRiskLevel = z.infer<typeof SupplierSlaRiskLevel>;

export const OpsSupplierSlaForecastQuery = z
  .object({
    tier: z.string().optional(),
    risk: SupplierSlaRiskLevel.optional(),
  })
  .partial();

export type OpsSupplierSlaForecastQuery = z.infer<typeof OpsSupplierSlaForecastQuery>;

export const SupplierSlaForecastHeatmapEntry = z.object({
  supplier: z.string(),
  display_name: z.string(),
  tier: z.string(),
  risk: SupplierSlaRiskLevel,
  profile_url: z.string(),
  metrics: z.object({
    avg_confirmation_hours: z.number(),
    open_confirms: z.number(),
    cancellations_pct: z.number(),
    breach_state: z.string(),
    last_breach_at: z.string().nullable(),
  }),
});

export type SupplierSlaForecastHeatmapEntry = z.infer<typeof SupplierSlaForecastHeatmapEntry>;

export const SupplierSlaForecastBucket = z.object({
  suppliers: z.array(z.string()),
  avg_confirmation_hours: z.number(),
  avg_cancellations_pct: z.number(),
  total_open_confirms: z.number(),
});

export type SupplierSlaForecastBucket = z.infer<typeof SupplierSlaForecastBucket>;

export const SupplierSlaForecastHealthCheck = z.object({
  name: z.string(),
  status: z.enum(["pass", "warn", "fail"]),
  observed_at: z.string(),
  detail: z.string().nullable(),
});

export type SupplierSlaForecastHealthCheck = z.infer<typeof SupplierSlaForecastHealthCheck>;

export const SupplierSlaForecastSample = z.object({
  request: z.object({
    method: z.string(),
    path: z.string(),
    description: z.string().optional(),
  }),
  response: z
    .object({
      summary: z
        .object({
          supplier: z.string(),
          risk: SupplierSlaRiskLevel,
          profile_url: z.string(),
        })
        .optional(),
    })
    .nullable(),
});

export type SupplierSlaForecastSample = z.infer<typeof SupplierSlaForecastSample>;

export const SupplierSlaForecastResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  generated_at: z.string().optional(),
  filters: z
    .object({
      tier: z.string().nullable(),
      risk: SupplierSlaRiskLevel.nullable(),
    })
    .optional(),
  totals: z
    .object({
      suppliers: z.number(),
      by_risk: z.object({
        breach: z.number(),
        warning: z.number(),
        on_track: z.number(),
      }),
      by_tier: z.record(z.string(), z.number()),
    })
    .optional(),
  visible: z
    .object({
      suppliers: z.number(),
      by_risk: z.object({
        breach: z.number(),
        warning: z.number(),
        on_track: z.number(),
      }),
      by_tier: z.record(z.string(), z.number()),
    })
    .optional(),
  buckets: z
    .object({
      breach: SupplierSlaForecastBucket,
      warning: SupplierSlaForecastBucket,
      on_track: SupplierSlaForecastBucket,
    })
    .optional(),
  heatmap: z.array(SupplierSlaForecastHeatmapEntry).optional(),
  health_checks: z.array(SupplierSlaForecastHealthCheck).optional(),
  samples: SupplierSlaForecastSample.optional(),
});

export type SupplierSlaForecastResponse = z.infer<typeof SupplierSlaForecastResponse>;

export const RefundPolicySummaryClause = z.object({
  title: z.string(),
  description: z.string().optional(),
  window_hours: z.number().int().nonnegative().optional(),
  penalty_cents: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
});

export type RefundPolicySummaryClause = z.infer<typeof RefundPolicySummaryClause>;

export const RefundPolicySummary = z.object({
  headline: z.string(),
  refundable: z.boolean().optional(),
  summary: z.array(z.string()).default([]),
  clauses: z.array(RefundPolicySummaryClause).default([]),
  notes: z.array(z.string()).default([]),
  source: z.string().optional(),
  updated_at: z.string().optional(),
});

export type RefundPolicySummary = z.infer<typeof RefundPolicySummary>;

export const RefundPolicySummarizeInput = z.object({
  itinerary_id: z.string().uuid().optional(),
  booking_id: z.string().optional(),
  supplier_id: z.string().optional(),
  product_code: z.string().optional(),
  locale: z.string().min(2).default("en"),
});

export type RefundPolicySummarizeInput = z.infer<typeof RefundPolicySummarizeInput>;

export const RefundPolicySummarizeResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  policy: RefundPolicySummary.optional(),
  message: z.string().optional(),
});

export type RefundPolicySummarizeResponse = z.infer<typeof RefundPolicySummarizeResponse>;
