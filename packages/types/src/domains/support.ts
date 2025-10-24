import { z } from "zod";

export const SosContact = z.object({
  id: z.string(),
  label: z.string(),
  phone: z.string(),
  channel: z.string(),
  timezone: z.string().optional(),
  languages: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type SosContact = z.infer<typeof SosContact>;

export const SosActionInput = z.object({
  contact_id: z.string(),
  action: z.string(),
  note: z.string().optional(),
});

export type SosActionInput = z.infer<typeof SosActionInput>;
