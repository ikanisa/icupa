import { CardGlass, Stepper } from "@ecotrips/ui";

export default function DashboardPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
    </div>
  );
}
