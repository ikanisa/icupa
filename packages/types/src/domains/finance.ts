import { z } from "zod";

export const InvoiceGenerateInput = z.object({
  kind: z.enum(["invoice", "credit_note"]),
  payment_id: z.string().uuid(),
  itinerary_id: z.string().uuid().optional(),
});

export type InvoiceGenerateInput = z.infer<typeof InvoiceGenerateInput>;
