import { SynthGenerateInput, SynthGenerateResponse } from "@ecotrips/types";
import type { DescriptorMap } from "../types";

export const adminDescriptors = {
  "admin.synth.generate": {
    path: "/functions/v1/synth-generate",
    method: "POST",
    auth: "user",
    input: SynthGenerateInput.default({}),
    output: SynthGenerateResponse,
  },
} satisfies DescriptorMap;
