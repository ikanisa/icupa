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
