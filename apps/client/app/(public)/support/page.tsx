import { CardGlass, buttonClassName } from "@ecotrips/ui";

import { SupportChat } from "../components/SupportChat";

export default function SupportPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <CardGlass title="Support" subtitle="SupportCopilot triages with human-in-the-loop controls.">
        <p className="text-sm text-white/80">
          Chat with ConciergeGuide for travel nudges or escalate to ops. Refunds, credit notes, and payouts always require HITL
          approval.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="https://wa.me/250789123456" className={buttonClassName("glass")}>
            Chat on WhatsApp
          </a>
          <a href="/support?refund=1" className={buttonClassName("secondary")}>
            Request refund
          </a>
        </div>
        <div className="mt-6">
          <SupportChat />
        </div>
      </CardGlass>
      <CardGlass title="Safety" subtitle="SafetyAgent monitors night travel and weather advisories.">
        <ul className="space-y-2 text-sm text-white/80">
          <li>• Emergency contacts cached offline.</li>
          <li>• Daily brief push to wallet and WhatsApp.</li>
        </ul>
      </CardGlass>
    </div>
  );
}
