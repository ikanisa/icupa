import { z } from "zod";

export const PermitRequest = z.object({
  park: z.string().min(2),
  visitDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_date"),
  pax: z.number().int().min(1),
  contactEmail: z.string().email(),
  phone: z.string().min(7),
  notes: z.string().max(500).optional(),
});

export type PermitRequest = z.infer<typeof PermitRequest>;
