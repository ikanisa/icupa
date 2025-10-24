import { z } from "zod";

export const VoiceCallInitiateInput = z.object({
  thread_id: z.string().min(1),
  traveler_name: z.string().min(1),
  traveler_phone: z.string().min(3),
  locale: z.string().min(2).default("en"),
  entry_point: z.string().min(1).default("ops_console"),
});

export type VoiceCallInitiateInput = z.infer<typeof VoiceCallInitiateInput>;

export const VoiceTranscriptTurn = z.object({
  speaker: z.enum(["agent", "traveler", "system"]).default("agent"),
  text: z.string().min(1),
  timestamp: z.string().optional(),
});

export type VoiceTranscriptTurn = z.infer<typeof VoiceTranscriptTurn>;

export const VoiceCallSummarizeInput = z.object({
  thread_id: z.string().min(1),
  call_id: z.string().min(1),
  transcript: z.array(VoiceTranscriptTurn).min(1),
});

export type VoiceCallSummarizeInput = z.infer<typeof VoiceCallSummarizeInput>;

export const VoiceCallDetails = z.object({
  call_id: z.string(),
  thread_id: z.string(),
  status: z.string(),
  dialer_url: z.string().url().optional(),
  expires_at: z.string().optional(),
  locale: z.string().optional(),
  agent: z
    .object({
      name: z.string().optional(),
      extension: z.string().optional(),
    })
    .partial()
    .optional(),
  participant: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
    })
    .partial()
    .optional(),
});

export type VoiceCallDetails = z.infer<typeof VoiceCallDetails>;

export const VoiceCallInitiateResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  call: VoiceCallDetails.optional(),
  message: z.string().optional(),
});

export type VoiceCallInitiateResponse = z.infer<typeof VoiceCallInitiateResponse>;

export const VoiceCallSummary = z.object({
  call_id: z.string(),
  headline: z.string(),
  sentiment: z.string().optional(),
  highlights: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  duration_seconds: z.number().optional(),
  transcript_turns: z.number().optional(),
});

export type VoiceCallSummary = z.infer<typeof VoiceCallSummary>;

export const VoiceCallSummaryEntry = z.object({
  type: z.literal("call_summary"),
  call_id: z.string(),
  created_at: z.string(),
  headline: z.string(),
  highlights: z.array(z.string()).default([]),
  next_steps: z.array(z.string()).default([]),
  sentiment: z.string().optional(),
});

export type VoiceCallSummaryEntry = z.infer<typeof VoiceCallSummaryEntry>;

export const VoiceCallSummarizeResponse = z.object({
  ok: z.boolean(),
  request_id: z.string().optional(),
  summary: VoiceCallSummary.optional(),
  thread_entry: VoiceCallSummaryEntry.optional(),
  message: z.string().optional(),
});

export type VoiceCallSummarizeResponse = z.infer<typeof VoiceCallSummarizeResponse>;
