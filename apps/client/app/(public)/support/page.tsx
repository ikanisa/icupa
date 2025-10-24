import { CardGlass, buttonClassName } from "@ecotrips/ui";
import { OptionCard } from "../components/OptionCard";

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
      </CardGlass>
      <CardGlass title="Safety" subtitle="SafetyAgent monitors night travel and weather advisories.">
        <ul className="space-y-2 text-sm text-white/80">
          <li>• Emergency contacts cached offline.</li>
          <li>• Daily brief push to wallet and WhatsApp.</li>
        </ul>
      </CardGlass>
      <OptionCard
        title="Disruption rebook suggestions"
        subtitle="ConciergeGuide calls rebook-suggest when flights slip so you stay ahead of queues."
        actionLabel="Review options"
        actionHref="/support?rebook=1"
      >
        <p>Chat threads surface proactive alternatives with fare, carrier, and lounge entitlements. Every payload links back to disruption-board entries so ops has full context.</p>
        <p className="text-xs text-white/60">Fixture fallbacks keep the chat hydrated even if providers-air-status is offline; we log the mode so ops can chase suppliers.</p>
      </OptionCard>
    </div>
  );
}
