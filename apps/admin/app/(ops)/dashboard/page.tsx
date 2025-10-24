import { CardGlass, Stepper } from "@ecotrips/ui";

import { FinopsCostPanel } from "./FinopsCostPanel";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <CardGlass
        title="Ops Status"
        subtitle="Realtime summary of incidents, bookings, and exceptions"
      >
        <ul className="grid gap-3 text-sm">
          <li className="flex items-center justify-between">
            <span>Open incidents</span>
            <span className="font-semibold text-amber-200">0</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Exceptions queue</span>
            <span className="font-semibold text-rose-200">3 (2 retriable)</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Escrows meeting target</span>
            <span className="font-semibold text-emerald-200">74%</span>
          </li>
        </ul>
      </CardGlass>
      <CardGlass
        title="Daily Runbook"
        subtitle="Follow the morning ops sweep to keep ecoTrips healthy"
      >
        <Stepper
          steps={[
            { id: "exceptions", label: "Review open exceptions", status: "complete" },
            { id: "bookings", label: "Check bookings with pending confirmations", status: "current" },
            { id: "drill", label: "DR drill scheduled for 14:00", status: "pending" },
          ]}
        />
      </CardGlass>
      <FinopsCostPanel />
      <CardGlass
        title="Promise Board Snapshot"
        subtitle="Track supplier promises by promise board columns"
      >
        <ul className="grid gap-3 text-sm">
          <li className="flex items-center justify-between">
            <span className="text-white/80">Committed</span>
            <span className="font-semibold text-emerald-200">12</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-white/80">In Review</span>
            <span className="font-semibold text-sky-200">5</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="text-white/80">Blocked</span>
            <span className="font-semibold text-rose-200">1 (ops owning)</span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-white/60">
          Counts sync nightly from <code className="rounded bg-white/10 px-1 py-0.5 text-[11px] uppercase tracking-wide">supplier_crm.threads.promise_column</code>.
        </p>
      </CardGlass>
      <CardGlass
        title="Promise Board Assets"
        subtitle="Drop screenshots here before shipping the weekly digest"
      >
        <div className="space-y-3 text-xs text-white/70">
          <p>
            Capture each column snapshot before updating suppliers. Replace these placeholders with fresh screenshots so downstream decks stay current.
          </p>
          <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center uppercase tracking-wide text-white/60">
            Committed Column Screenshot
          </div>
          <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center uppercase tracking-wide text-white/60">
            In Review Column Screenshot
          </div>
          <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-6 text-center uppercase tracking-wide text-white/60">
            Blocked Column Screenshot
          </div>
        </div>
      </CardGlass>
    </div>
  );
}
