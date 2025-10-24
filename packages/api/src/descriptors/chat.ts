import { z } from "zod";

import type { DescriptorMap } from "../types";
import { VoiceSession, VoiceSessionInput } from "@ecotrips/types";

export const chatDescriptors = {
  "chat.voiceSession": {
    path: "/functions/v1/voice-session",
    method: "POST",
    auth: "anon",
    input: VoiceSessionInput,
    output: z.object({
      ok: z.boolean(),
      session: VoiceSession,
      request_id: z.string().optional(),
      loopback: z.boolean().optional(),
    }),
  },
} satisfies DescriptorMap;
