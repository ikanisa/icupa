import { z } from "zod";

import type { DescriptorMap } from "../types";
import { DrSnapshotInput } from "@ecotrips/types";

export const drDescriptors = {
  "dr.snapshot": {
    path: "/functions/v1/dr-snapshot",
    method: "POST",
    auth: "user",
    input: DrSnapshotInput,
    output: z.object({
      ok: z.boolean(),
      snapshot_id: z.string().optional(),
      object_path: z.string().optional(),
      bytes: z.number().optional(),
      sha256: z.string().optional(),
    }),
  },
} satisfies DescriptorMap;
