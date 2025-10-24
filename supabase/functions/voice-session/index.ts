import sessionsFixture from "../../../ops/fixtures/voice_sessions.json" assert { type: "json" };
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface VoiceSessionBody {
  itinerary_id?: unknown;
  language?: unknown;
  prompt?: unknown;
  loopback?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("voice-session");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: VoiceSessionBody;
  try {
    payload = (await req.json()) as VoiceSessionBody;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const itineraryId = typeof payload.itinerary_id === "string" ? payload.itinerary_id : null;
  const language = typeof payload.language === "string" ? payload.language : "en";
  const prompt = typeof payload.prompt === "string" ? payload.prompt : undefined;
  const loopback = payload.loopback !== false;

  const session = findSession(itineraryId, language) ?? buildMockSession(language, itineraryId, prompt);

  console.log(
    JSON.stringify({
      level: "INFO",
      event: "chat.voice.session",
      fn: "voice-session",
      requestId,
      itineraryId,
      sessionId: session.session_id,
      language: session.language,
      prompt,
      loopback,
    }),
  );

  if (!loopback) {
    session.audio_url = undefined;
  }

  return jsonResponse({ ok: true, session, request_id: requestId, loopback });
}, { fn: "voice-session" });

Deno.serve(handler);

type TranscriptLine = { role: string; text: string };

type VoiceSession = {
  session_id: string;
  itinerary_id?: string;
  language: string;
  transcript: TranscriptLine[];
  audio_url?: string;
  latency_ms: number;
};

function findSession(itineraryId: string | null, language: string): VoiceSession | null {
  if (!Array.isArray(sessionsFixture)) return null;
  const match = (sessionsFixture as Array<Record<string, unknown>>).find((entry) => {
    const entryItinerary = typeof entry.itinerary_id === "string" ? entry.itinerary_id : null;
    const entryLanguage = typeof entry.language === "string" ? entry.language : "en";
    if (itineraryId && entryItinerary !== itineraryId) return false;
    return entryLanguage === language;
  });

  if (!match) return null;

  const transcript = Array.isArray(match.transcript)
    ? match.transcript.map((line) => ({
      role: String((line as Record<string, unknown>).role ?? "concierge"),
      text: String((line as Record<string, unknown>).text ?? ""),
    }))
    : [];

  return {
    session_id: String(match.session_id ?? crypto.randomUUID()),
    itinerary_id: typeof match.itinerary_id === "string" ? match.itinerary_id : itineraryId ?? undefined,
    language: typeof match.language === "string" ? match.language : language,
    transcript,
    audio_url: typeof match.audio_url === "string" ? match.audio_url : undefined,
    latency_ms: Number(match.latency_ms ?? 900),
  };
}

function buildMockSession(language: string, itineraryId: string | null, prompt?: string): VoiceSession {
  const transcript: TranscriptLine[] = [
    { role: "traveler", text: prompt ?? "Hi concierge, can you confirm tomorrow's plan?" },
    {
      role: "concierge",
      text: "PlannerCoPilot confirms dawn pickup with driver Aline. Offline checklist synced to wallet.",
    },
  ];

  return {
    session_id: crypto.randomUUID(),
    itinerary_id: itineraryId ?? undefined,
    language,
    transcript,
    audio_url: "https://demo.ecotrips.app/audio/voice-session-mock.mp3",
    latency_ms: 950,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
