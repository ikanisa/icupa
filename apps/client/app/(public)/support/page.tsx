import { CardGlass } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { PriceBreakdown } from "@ecotrips/types";

import { ChatOptionModals } from "./ChatOptionModals";

async function loadSupportBreakdowns(): Promise<Record<string, PriceBreakdown>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return {};
  }

  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });

  try {
    const response = await client.call("helpers.price", { option_ids: ["support-whatsapp", "support-refund"] });
    if (!response.ok) {
      return {};
    }
    const map: Record<string, PriceBreakdown> = {};
    for (const entry of response.breakdowns ?? []) {
      map[entry.option_id] = entry.breakdown;
    }
    return map;
  } catch (error) {
    console.error("helpers.price support", error);
    return {};
  }
}

export default async function SupportPage() {
  const breakdowns = await loadSupportBreakdowns();

import { SosCard } from "./SosCard";

export default function SupportPage() {
  return (
    <PublicPage>
      <CardGlass title="Support" subtitle="SupportCopilot triages with human-in-the-loop controls.">
        <p className="text-sm text-white/80">
          Chat with ConciergeGuide for travel nudges or escalate to ops. Refunds, credit notes, and payouts always require HITL approval.
        </p>
        <ChatOptionModals breakdowns={breakdowns} />
      </CardGlass>
      <CardGlass title="SOS kit" subtitle="Escalation-ready contacts with call and share actions.">
        <SosCard />
      </CardGlass>
      <CardGlass title="Safety" subtitle="SafetyAgent monitors night travel and weather advisories.">
        <ul className="space-y-2 text-sm text-white/80">
          <li>• Emergency contacts cached offline.</li>
          <li>• Daily brief push to wallet and WhatsApp.</li>
        </ul>
      </CardGlass>
    </PublicPage>
  );
}
