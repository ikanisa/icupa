import { CardGlass, buttonClassName } from "@ecotrips/ui";

export default function WhatsAppPage() {
  return (
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
  );
}
