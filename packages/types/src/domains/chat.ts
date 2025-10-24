import { z } from "zod";

export const VoiceSessionInput = z.object({
  itinerary_id: z.string().uuid().optional(),
  language: z.string().default("en"),
  prompt: z.string().optional(),
  loopback: z.boolean().optional(),
});

export type VoiceSessionInput = z.infer<typeof VoiceSessionInput>;

export const VoiceTranscriptLine = z.object({
  role: z.string(),
  text: z.string(),
});

export type VoiceTranscriptLine = z.infer<typeof VoiceTranscriptLine>;

export const VoiceSession = z.object({
  session_id: z.string(),
  itinerary_id: z.string().uuid().optional(),
  language: z.string(),
  transcript: z.array(VoiceTranscriptLine),
  audio_url: z.string().url().optional(),
  latency_ms: z.number(),
});

export type VoiceSession = z.infer<typeof VoiceSession>;
