import { CardGlass, buttonClassName } from "@ecotrips/ui";
import { OptionCard } from "../components/OptionCard";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { PublicPage } from "../components/PublicPage";

export const metadata = createPageMetadata({
  title: "Support",
  description: "Reach SupportCopilot, escalate refunds, and review safety briefings in one place.",
  path: "/support",
});

export default function SupportPage() {
  return (
    <PublicPage>
      <CardGlass title="Support" subtitle="SupportCopilot triages with human-in-the-loop controls.">
        <p className="text-sm text-white/80">
          Chat with ConciergeGuide for travel nudges or escalate to ops. Refunds, credit notes, and payouts always require HITL approval.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="https://wa.me/250789123456" className={buttonClassName("glass")}>
            Chat on WhatsApp
          </a>
          <a href="/support?refund=1" className={buttonClassName("secondary")}>
            Request refund
          </a>
        </div>
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
