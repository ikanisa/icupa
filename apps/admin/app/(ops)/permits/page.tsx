import { CardGlass, buttonClassName } from "@ecotrips/ui";

const permits = [
  { requestId: "PM-310", park: "Volcanoes", visitDate: "2024-05-12", pax: 4, status: "pending" },
  { requestId: "PM-298", park: "Nyungwe", visitDate: "2024-05-18", pax: 2, status: "approved" },
];

export default function PermitsPage() {
  return (
    <CardGlass title="Permit approvals" subtitle="Ops HITL required before notifying travelers.">
      <div className="space-y-4">
        {permits.map((permit) => (
          <div key={permit.requestId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">{permit.requestId}</p>
              <h3 className="text-base font-semibold">{permit.park}</h3>
              <p className="text-sm text-white/70">Visit {permit.visitDate} · {permit.pax} pax</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={buttonClassName("glass")}>Approve</button>
              <button type="button" className={buttonClassName("secondary")}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </CardGlass>
  );
}
