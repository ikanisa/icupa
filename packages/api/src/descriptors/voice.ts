import { VoiceCallInitiateInput, VoiceCallInitiateResponse, VoiceCallSummarizeInput, VoiceCallSummarizeResponse } from "@ecotrips/types";

import type { DescriptorMap } from "../types";

export const voiceDescriptors = {
  "voice.call.initiate": {
    path: "/functions/v1/voice-call-initiate",
    method: "POST",
    auth: "user",
    input: VoiceCallInitiateInput,
    output: VoiceCallInitiateResponse,
  },
  "voice.call.summarize": {
    path: "/functions/v1/voice-call-summarize",
    method: "POST",
    auth: "user",
    input: VoiceCallSummarizeInput,
    output: VoiceCallSummarizeResponse,
  },
} satisfies DescriptorMap;
