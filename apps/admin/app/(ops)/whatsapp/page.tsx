import { CardGlass, buttonClassName } from "@ecotrips/ui";
import type {
  VoiceCallInitiateInput,
  VoiceCallSummarizeInput,
  VoiceTranscriptTurn,
} from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { logAdminAction } from "../../../lib/logging";
import voiceFixture from "../../../../ops/fixtures/voice_contact_thread.json";
import { ContactThreadPanel, type ContactThreadState, type ThreadEntry } from "./ContactThreadPanel";

type VoiceContactFixture = {
  thread: {
    id: string;
    subject: string;
    traveler: { name: string; phone: string };
    entries: Array<{
      id: string;
      type: "message" | "note";
      author: string;
      channel: string;
      sent_at: string;
      body: string;
    }>;
  };
  voice_call: {
    call_id: string;
    dialer_url: string;
    agent: { name?: string; extension?: string };
    participant: { name?: string; phone?: string };
    expires_in_seconds: number;
  };
  transcript: VoiceTranscriptTurn[];
  summary: {
    headline: string;
    sentiment?: string;
    highlights: string[];
    next_steps: string[];
    duration_seconds?: number;
  };
};

const voiceData = voiceFixture as VoiceContactFixture;

const initialEntries: ThreadEntry[] = voiceData.thread.entries.map((entry) => ({
  id: entry.id,
  type: entry.type,
  author: entry.author,
  channel: entry.channel,
  sent_at: entry.sent_at,
  body: entry.body,
}));

const initialThreadState: ContactThreadState = {
  status: "idle",
  entries: initialEntries,
};

async function contactThreadAction(
  prevState: ContactThreadState,
  formData: FormData,
): Promise<ContactThreadState> {
  "use server";

  const intent = String(formData.get("intent") ?? "").toLowerCase();
  const baseState: ContactThreadState = {
    ...prevState,
    status: "idle",
    message: undefined,
    detail: undefined,
  };

  if (!intent) {
    return baseState;
  }

  const client = await getOpsFunctionClient();
  if (!client) {
    logAdminAction("voice.call.action", { status: "offline", intent });
    return { ...baseState, status: "offline", message: "Supabase client unavailable for voice toolkit." };
  }

  const entries = [...prevState.entries];

  if (intent === "initiate") {
    try {
      const initiatePayload: VoiceCallInitiateInput = {
        thread_id: voiceData.thread.id,
        traveler_name: voiceData.thread.traveler.name,
        traveler_phone: voiceData.thread.traveler.phone,
        locale: "en",
        entry_point: "ops_console",
      };

      const response = await client.call("voice.call.initiate", initiatePayload);

      if (!response.ok || !response.call) {
        logAdminAction("voice.call.initiate", {
          status: "error",
          requestId: response.request_id,
          message: response.message ?? "initiate_failed",
        });
        return {
          ...baseState,
          status: "error",
          message: "Voice bridge failed to start.",
          detail: response.message ?? "voice-call-initiate returned an error",
          requestId: response.request_id,
        };
      }

      const callEntry: ThreadEntry = {
        id: `call-${response.call.call_id}`,
        type: "call",
        author: "ops",
        channel: "voice",
        sent_at: new Date().toISOString(),
        body: `Initiated voice call with ${response.call.participant?.name ?? voiceData.thread.traveler.name}.`,
        call_id: response.call.call_id,
        dialer_url: response.call.dialer_url,
        expires_at: response.call.expires_at,
      };

      const filtered = entries.filter((entry) => entry.type !== "call" || entry.call_id !== callEntry.call_id);
      filtered.push(callEntry);

      logAdminAction("voice.call.initiate", {
        status: "success",
        requestId: response.request_id,
        callId: response.call.call_id,
      });

      return {
        ...baseState,
        status: "success",
        message: "Voice call initiated.",
        entries: filtered,
        call: {
          callId: response.call.call_id,
          status: response.call.status ?? "connecting",
          dialerUrl: response.call.dialer_url,
          expiresAt: response.call.expires_at,
          participantName: response.call.participant?.name ?? voiceData.thread.traveler.name,
          participantPhone: response.call.participant?.phone ?? voiceData.thread.traveler.phone,
        },
        requestId: response.request_id,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logAdminAction("voice.call.initiate", { status: "error", message: detail });
      return {
        ...baseState,
        status: "error",
        message: "Voice bridge threw an exception.",
        detail,
      };
    }
  }

  if (intent === "summarize") {
    const callId = prevState.call?.callId ?? voiceData.voice_call.call_id;
    try {
      const summarizePayload: VoiceCallSummarizeInput = {
        thread_id: voiceData.thread.id,
        call_id: callId,
        transcript: voiceData.transcript,
      };

      const response = await client.call("voice.call.summarize", summarizePayload);

      if (!response.ok || !response.summary) {
        logAdminAction("voice.call.summarize", {
          status: "error",
          requestId: response.request_id,
          message: response.message ?? "summarize_failed",
        });
        return {
          ...baseState,
          status: "error",
          message: "Summary generation failed.",
          detail: response.message ?? "voice-call-summarize returned an error",
          requestId: response.request_id,
        };
      }

      const entryId = `call-summary-${callId}-${crypto.randomUUID()}`;
      const createdAt = response.thread_entry?.created_at ?? new Date().toISOString();
      const summaryEntry: ThreadEntry = {
        id: entryId,
        type: "call_summary",
        author: "ops",
        channel: "voice",
        sent_at: createdAt,
        body: response.summary.headline,
        highlights: response.thread_entry?.highlights ?? response.summary.highlights,
        next_steps: response.thread_entry?.next_steps ?? response.summary.next_steps,
        sentiment: response.thread_entry?.sentiment ?? response.summary.sentiment,
        call_id: callId,
      };

      entries.push(summaryEntry);

      logAdminAction("voice.call.summarize", {
        status: "success",
        requestId: response.request_id,
        callId,
      });

      return {
        ...baseState,
        status: "success",
        message: response.summary.headline,
        detail: response.summary.next_steps?.join?.(" · ") ?? undefined,
        entries,
        call: prevState.call,
        requestId: response.request_id,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logAdminAction("voice.call.summarize", { status: "error", message: detail });
      return {
        ...baseState,
        status: "error",
        message: "Summary request threw an exception.",
        detail,
      };
    }
  }

  return baseState;
}

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <CardGlass title="Conversation queue" subtitle="SupportCopilot keeps context but HITL approves payouts.">
          <p>
            Recent inbound traveler: <strong>+250 789 123 456</strong>. Concierge suggests rerouting to avoid night travel.
            Approve template message below to confirm.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="font-semibold text-sky-200">Template preview</p>
            <p className="mt-2 text-white/80">
              Muraho! Your gorilla trek is still on schedule. Our driver will meet you at 05:30 at the hotel lobby. Reply 1 to
              confirm or 2 to connect with an agent.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClassName("glass")}>
              Send via wa-send
            </button>
            <button type="button" className={buttonClassName("secondary")}>
              Escalate to duty manager
            </button>
          </div>
        </CardGlass>
        <CardGlass title="Automation" subtitle="Feature flags enable WA_OFFLINE fallback when API is degraded.">
          <p className="text-sm text-white/80">
            Observability events stream to metrics counters with tags (template, success, failure). Synthetic probes run every 5
            minutes.
          </p>
        </CardGlass>
      </div>
      <CardGlass
        title="Voice concierge pilot"
        subtitle="Initiate mock voice calls and store human-in-the-loop summaries on the contact thread."
      >
        <ContactThreadPanel
          action={contactThreadAction}
          initialState={initialThreadState}
          travelerName={voiceData.thread.traveler.name}
          travelerPhone={voiceData.thread.traveler.phone}
          subject={voiceData.thread.subject}
        />
      </CardGlass>
    </div>
  );
}
