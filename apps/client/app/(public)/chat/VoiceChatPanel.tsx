"use client";

import { useState } from "react";
import { Button } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { VoiceSession } from "@ecotrips/types";

import { captureClientEvent } from "../../../lib/analytics";

const clientPromise = (async () => {
  if (typeof window === "undefined") return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });
})();

type SessionState = {
  session: VoiceSession | null;
  pending: boolean;
  error: string | null;
  microphone: boolean;
};

export function VoiceChatPanel() {
  const [prompt, setPrompt] = useState("Confirm dawn pickup and send packing checklist.");
  const [state, setState] = useState<SessionState>({ session: null, pending: false, error: null, microphone: false });

  const requestMicrophone = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({ ...prev, microphone: false }));
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setState((prev) => ({ ...prev, microphone: true }));
      captureClientEvent("voice_session_microphone_ready", {});
    } catch (error) {
      console.error("microphone_request_failed", error);
      setState((prev) => ({ ...prev, microphone: false }));
    }
  };

  const startSession = async () => {
    captureClientEvent("voice_session_requested", { prompt });
    const client = await clientPromise;
    if (!client) {
      setState({ session: null, pending: false, error: "Supabase client unavailable", microphone: state.microphone });
      captureClientEvent("voice_session_error", { prompt, reason: "offline" });
      return;
    }

    setState((prev) => ({ ...prev, pending: true, error: null }));
    try {
      const response = await client.chat.voiceSession({ prompt, loopback: true });
      setState({ session: response.session, pending: false, error: null, microphone: state.microphone });
      captureClientEvent("voice_session_ready", { sessionId: response.session.session_id, latency: response.session.latency_ms });
      if (response.session.audio_url) {
        const audio = new Audio(response.session.audio_url);
        void audio.play().catch((error) => console.error("audio_playback_failed", error));
      }
    } catch (error) {
      console.error("chat.voiceSession", error);
      setState({ session: null, pending: false, error: "Failed to start voice session", microphone: state.microphone });
      captureClientEvent("voice_session_error", { prompt, reason: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm">
        <span>Prompt ConciergeGuide</span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={startSession} disabled={state.pending}>
          {state.pending ? "Starting session…" : "Start voice session"}
        </Button>
        <Button variant="secondary" onClick={requestMicrophone} disabled={state.microphone}>
          {state.microphone ? "Mic ready" : "Enable microphone"}
        </Button>
      </div>
      {state.error && <p className="text-xs text-rose-200">{state.error}</p>}
      {state.session && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm uppercase tracking-wide text-white/60">Session {state.session.session_id}</p>
            <p className="text-xs text-white/50">Latency {state.session.latency_ms} ms</p>
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            {state.session.transcript.map((line, index) => (
              <li key={`${line.role}-${index}`} className="rounded-xl bg-white/10 px-3 py-2">
                <span className="font-semibold text-sky-200">{line.role === "concierge" ? "Concierge" : "Traveler"}:</span>{" "}
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
          {state.session.audio_url && (
            <audio controls className="w-full">
              <source src={state.session.audio_url} type="audio/mpeg" />
            </audio>
          )}
        </div>
      )}
    </div>
  );
}
