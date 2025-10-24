import type { Metadata } from "next";
import { CardGlass } from "@ecotrips/ui";

import { ChatOptionBoard } from "../components/ChatOptionBoard";

export const metadata: Metadata = {
  title: "Chat · PlannerCoPilot options",
  description: "Preview itinerary bundles and trigger holds or fare watches directly from chat.",
};

export default function ChatPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass
        title="PlannerCoPilot chat"
        subtitle="OptionCards surface bundle-aware actions for each itinerary candidate."
      >
        <p>
          Hold locks inventory for 15 minutes with idempotency keys; watch ties into the air-price-watch
          edge function for audit-ready fare alerts.
        </p>
      </CardGlass>
      <ChatOptionBoard />
    </div>
  );
}
