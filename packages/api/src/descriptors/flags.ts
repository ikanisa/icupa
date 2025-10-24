import { FlagsConfigResponse } from "@ecotrips/types";
import { z } from "zod";
import type { DescriptorMap } from "../types";

export const flagsDescriptors = {
  "flags.config": {
    path: "/functions/v1/flags-config",
    method: "GET",
    auth: "user",
    input: z.object({}).default({}),
    output: FlagsConfigResponse,
  },
} satisfies DescriptorMap;
