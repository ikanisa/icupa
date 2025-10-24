import { z } from "zod";

import type { DescriptorMap } from "../types";
import { SosActionInput, SosContact } from "@ecotrips/types";

export const supportDescriptors = {
  "support.sosContacts": {
    path: "/functions/v1/sos-contacts",
    method: "GET",
    auth: "anon",
    input: z.object({}).optional(),
    output: z.object({
      ok: z.boolean(),
      contacts: z.array(SosContact).default([]),
      request_id: z.string().optional(),
    }),
  },
  "support.sosAction": {
    path: "/functions/v1/sos-contacts",
    method: "POST",
    auth: "anon",
    input: SosActionInput,
    output: z.object({
      ok: z.boolean(),
      contact_id: z.string().nullable().optional(),
      action: z.string().optional(),
      request_id: z.string().optional(),
    }),
  },
} satisfies DescriptorMap;
