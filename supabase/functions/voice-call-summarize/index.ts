import voiceFixture from "../../../ops/fixtures/voice_contact_thread.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const VOICE_CALL_MODE = (Deno.env.get("VOICE_CALL_MODE") ?? "mock").toLowerCase();
const SUPPORTED_MODE = VOICE_CALL_MODE === "mock";

const fixture = voiceFixture as VoiceContactFixture;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const actor = req.headers.get("authorization") ? "bearer" : "anonymous";
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("voice-call-summarize");
  }

  if (req.method !== "POST") {
    auditLog({ requestId, actor, details: "method_not_allowed" });
    return jsonResponse({ ok: false, error: "POST only", request_id: requestId }, 405);
  }

  let payload: VoiceCallSummarizeRequest;
  try {
    payload = (await req.json()) as VoiceCallSummarizeRequest;
  } catch (_error) {
    auditLog({ requestId, actor, details: "invalid_json" });
    return jsonResponse({ ok: false, error: "Invalid JSON", request_id: requestId }, 400);
  }

  const callId = typeof payload.call_id === "string" && payload.call_id
    ? payload.call_id
    : fixture.voice_call.call_id;
  const threadId = typeof payload.thread_id === "string" && payload.thread_id
    ? payload.thread_id
    : fixture.thread.id;
  const transcript = Array.isArray(payload.transcript)
    ? payload.transcript.filter(isTranscriptTurn)
    : fixture.transcript;

  if (!callId) {
    auditLog({ requestId, actor, details: "validation_error", field: "call_id" });
    return jsonResponse({ ok: false, error: "call_id is required", request_id: requestId }, 400);
  }

  if (!SUPPORTED_MODE) {
    auditLog({ requestId, actor, details: "unsupported_mode", mode: VOICE_CALL_MODE });
    return jsonResponse({ ok: false, error: "voice-call-summarize live mode not configured", request_id: requestId }, 503);
  }

  const summary = fixture.summary;
  const threadEntry = {
    type: "call_summary" as const,
    call_id: callId,
    created_at: new Date().toISOString(),
    headline: summary.headline,
    highlights: summary.highlights,
    next_steps: summary.next_steps,
    sentiment: summary.sentiment,
  } satisfies VoiceCallSummaryEntry;

  auditLog({
    requestId,
    actor,
    details: "mock_summary_ready",
    mode: VOICE_CALL_MODE,
    callId,
    threadId,
    transcript_turns: transcript.length,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    summary: {
      call_id: callId,
      headline: summary.headline,
      sentiment: summary.sentiment,
      highlights: summary.highlights,
      next_steps: summary.next_steps,
      duration_seconds: summary.duration_seconds,
      transcript_turns: transcript.length,
    },
    thread_entry: threadEntry,
  });
}, { fn: "voice-call-summarize", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function auditLog(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "voice.call.summarize",
      fn: "voice-call-summarize",
      ...fields,
    }),
  );
}

function isTranscriptTurn(turn: unknown): turn is TranscriptTurn {
  if (!turn || typeof turn !== "object") return false;
  const record = turn as Record<string, unknown>;
  return typeof record.speaker === "string" && typeof record.text === "string" && record.text.length > 0;
}

type VoiceCallSummarizeRequest = {
  call_id?: unknown;
  thread_id?: unknown;
  transcript?: unknown;
};

type TranscriptTurn = {
  speaker: string;
  timestamp?: string;
  text: string;
};

type VoiceCallSummaryEntry = {
  type: "call_summary";
  call_id: string;
  created_at: string;
  headline: string;
  highlights: string[];
  next_steps: string[];
  sentiment?: string;
};

type VoiceContactFixture = {
  thread: { id: string };
  voice_call: { call_id: string };
  transcript: TranscriptTurn[];
  summary: {
    headline: string;
    sentiment?: string;
    highlights: string[];
    next_steps: string[];
    duration_seconds?: number;
  };
};
