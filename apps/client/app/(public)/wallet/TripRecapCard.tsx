"use client";

import { useState } from "react";
import { Button } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
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

type RecapState = {
  recap: WalletTripRecapResponse | null;
  loading: boolean;
  error: string | null;
};

type WalletTripRecapResponse = {
  recap_id: string;
  subject: string;
  summary: string;
  highlights: string[];
  cta_url: string;
  preview_html: string;
  generated_at: string;
};

export function TripRecapCard() {
  const [itineraryId, setItineraryId] = useState("11111111-1111-4111-8111-111111111111");
  const [state, setState] = useState<RecapState>({ recap: null, loading: false, error: null });

  const generateRecap = async () => {
    captureClientEvent("recap_requested", { itineraryId });
    const client = await clientPromise;
    if (!client) {
      setState({ recap: null, loading: false, error: "Supabase client unavailable." });
      captureClientEvent("recap_error", { itineraryId, reason: "offline" });
      return;
    }

    setState({ recap: state.recap, loading: true, error: null });
    try {
      const response = await client.wallet.tripRecap({ itinerary_id: itineraryId });
      const recap = {
        recap_id: response.recap.recap_id,
        subject: response.recap.subject,
        summary: response.recap.summary,
        highlights: response.recap.highlights ?? [],
        cta_url: response.recap.cta_url,
        preview_html: response.recap.preview_html,
        generated_at: response.recap.generated_at,
      } satisfies WalletTripRecapResponse;
      setState({ recap, loading: false, error: null });
      captureClientEvent("recap_generated", { itineraryId, recapId: recap.recap_id });
    } catch (error) {
      console.error("wallet.tripRecap", error);
      setState({ recap: null, loading: false, error: "Failed to generate recap." });
      captureClientEvent("recap_error", { itineraryId, reason: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm">
        <span>Itinerary ID</span>
        <input
          value={itineraryId}
          onChange={(event) => setItineraryId(event.target.value)}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="itinerary UUID"
        />
      </label>
      <Button onClick={generateRecap} disabled={state.loading}>
        {state.loading ? "Generating recap…" : "Generate recap"}
      </Button>
      {state.error && <p className="text-xs text-rose-200">{state.error}</p>}
      {state.recap && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-white/60">{state.recap.subject}</p>
            <p className="text-sm text-white/80">{state.recap.summary}</p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-white/60">
            {state.recap.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
          <div className="rounded-xl border border-white/10 bg-white/10 p-3 text-xs text-white/80">
            <p className="mb-1 font-semibold text-white/90">Email preview</p>
            <div dangerouslySetInnerHTML={{ __html: state.recap.preview_html }} />
          </div>
          <a href={state.recap.cta_url} className="text-xs text-sky-200 underline">
            View recap in wallet
          </a>
        </div>
      )}
    </div>
  );
}
