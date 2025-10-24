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
    return healthResponse("voice-call-initiate");
  }

  if (req.method !== "POST") {
    auditLog({ requestId, actor, details: "method_not_allowed" });
    return jsonResponse({ ok: false, error: "POST only", request_id: requestId }, 405);
  }

  let payload: VoiceCallInitiateRequest;
  try {
    payload = (await req.json()) as VoiceCallInitiateRequest;
  } catch (_error) {
    auditLog({ requestId, actor, details: "invalid_json" });
    return jsonResponse({ ok: false, error: "Invalid JSON", request_id: requestId }, 400);
  }

  const threadId = typeof payload.thread_id === "string" && payload.thread_id
    ? payload.thread_id
    : fixture.thread.id;
  const travelerName = typeof payload.traveler_name === "string" && payload.traveler_name
    ? payload.traveler_name
    : fixture.thread.traveler.name;
  const travelerPhone = typeof payload.traveler_phone === "string" && payload.traveler_phone
    ? payload.traveler_phone
    : fixture.thread.traveler.phone;
  const locale = typeof payload.locale === "string" && payload.locale
    ? payload.locale
    : "en";

  if (!threadId) {
    auditLog({ requestId, actor, details: "validation_error", field: "thread_id" });
    return jsonResponse({ ok: false, error: "thread_id is required", request_id: requestId }, 400);
  }

  if (!SUPPORTED_MODE) {
    auditLog({ requestId, actor, details: "unsupported_mode", mode: VOICE_CALL_MODE });
    return jsonResponse({ ok: false, error: "voice-call-initiate live mode not configured", request_id: requestId }, 503);
  }

  const baseCall = fixture.voice_call;
  const callId = `mock-${crypto.randomUUID()}`;
  const expiresInSeconds = Number.isFinite(baseCall.expires_in_seconds)
    ? baseCall.expires_in_seconds
    : 300;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1_000).toISOString();

  const call: VoiceCallResponse = {
    call_id: callId,
    thread_id: threadId,
    status: "connecting",
    dialer_url: `${baseCall.dialer_url}?session=${callId}`,
    expires_at: expiresAt,
    locale,
    agent: baseCall.agent,
    participant: {
      name: travelerName,
      phone: travelerPhone,
    },
  };

  auditLog({
    requestId,
    actor,
    details: "mock_initiated",
    mode: VOICE_CALL_MODE,
    threadId,
    callId,
    locale,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    call,
  });
}, { fn: "voice-call-initiate", defaultErrorCode: ERROR_CODES.UNKNOWN });

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
      event: "voice.call.initiate",
      fn: "voice-call-initiate",
      ...fields,
    }),
  );
}

type VoiceCallInitiateRequest = {
  thread_id?: unknown;
  traveler_name?: unknown;
  traveler_phone?: unknown;
  locale?: unknown;
};

type VoiceContactFixture = {
  thread: {
    id: string;
    traveler: { name: string; phone: string };
  };
  voice_call: {
    dialer_url: string;
    expires_in_seconds: number;
    agent: Record<string, unknown>;
  } & Pick<VoiceCallResponse, "call_id" | "participant">;
};

type VoiceCallResponse = {
  call_id: string;
  thread_id: string;
  status: string;
  dialer_url: string;
  expires_at: string;
  locale: string;
  agent?: Record<string, unknown>;
  participant?: Record<string, unknown>;
};
