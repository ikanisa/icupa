import { AutonomyPreferencesResponse, AutonomyPreferencesUpsertInput } from "@ecotrips/types";
import { z } from "zod";

import type { DescriptorMap } from "../types";

export const userDescriptors = {
  "user.autonomy.get": {
    path: "/functions/v1/user-autonomy-save",
    method: "GET",
    auth: "user",
    input: z.object({}).optional(),
    output: AutonomyPreferencesResponse,
  },
  "user.autonomy.save": {
    path: "/functions/v1/user-autonomy-save",
    method: "POST",
    auth: "user",
    input: AutonomyPreferencesUpsertInput,
    output: AutonomyPreferencesResponse,
  },
} satisfies DescriptorMap;
