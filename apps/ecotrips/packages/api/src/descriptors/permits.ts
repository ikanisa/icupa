import { z } from "zod";

import type { DescriptorMap } from "../types";
import { PermitRequest } from "@ecotrips/types";

export const permitsDescriptors = {
  "permits.request": {
    path: "/functions/v1/permits-request",
    method: "POST",
    auth: "user",
    input: PermitRequest,
    output: z.object({ ok: z.boolean(), request_id: z.string().uuid().optional() }),
  },
} satisfies DescriptorMap;
