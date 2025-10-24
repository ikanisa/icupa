import { CardGlass, Button } from "@ecotrips/ui";
import { clsx } from "clsx";

import { loadSupplierOrders } from "../../lib/orders";

const statusLabels: Record<string, { label: string; tone: string }> = {
  awaiting_confirmation: { label: "Awaiting confirmation", tone: "bg-amber-400/20 text-amber-200" },
  confirmed: { label: "Confirmed", tone: "bg-emerald-400/20 text-emerald-200" },
  pending_docs: { label: "Pending documents", tone: "bg-sky-400/20 text-sky-200" },
};

export default async function OrdersPage() {
  const result = await loadSupplierOrders();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-14 sm:px-10 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300/80">Supplier workspace</p>
          <h1 className="text-3xl font-semibold text-white">Orders & confirmations</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-200/80">
            Review traveler manifests, confirm service delivery windows, and keep trust badges visible for ecoTrips operators.
          </p>
        </div>
        <Button variant="glass" asChild>
          <a href="/">Back to overview</a>
        </Button>
      </div>

      <CardGlass
        title="Order queue"
        subtitle={
          result.source === "live"
            ? "Live data fetched via supplier-orders edge function."
            : result.source === "fixtures"
              ? "Fixtures rendered — configure Supabase credentials for realtime orders."
              : "Edge function offline — showing cached fixtures."
        }
        className="border-white/10 bg-slate-900/70"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-300/70">
                <th className="pb-3">Order</th>
                <th className="pb-3">Itinerary</th>
                <th className="pb-3">Start</th>
                <th className="pb-3">Travelers</th>
                <th className="pb-3">Badges</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {result.orders.map((order) => {
                const status = statusLabels[order.status ?? ""] ?? {
                  label: order.status ?? "Unknown",
                  tone: "bg-slate-500/20 text-slate-200",
                };
                const amount = typeof order.total_cents === "number"
                  ? `${order.currency ?? "USD"} ${(order.total_cents / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
                  : "—";
                return (
                  <tr key={order.id} className="align-top">
                    <td className="py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-white/90">{order.id}</span>
                        <span className="text-xs text-slate-300/70">{amount}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-white/90">{order.itinerary}</span>
                        <span className="text-xs text-slate-300/70">{order.notes ?? "No special notes"}</span>
                      </div>
                    </td>
                    <td className="py-4">{order.start_date ?? "—"}</td>
                    <td className="py-4">{order.travelers ?? "—"}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        {(order.badges ?? []).map((badge) => (
                          <span
                            key={`${order.id}-${badge.code}`}
                            title={badge.description ?? badge.label ?? "Supplier badge"}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100/90"
                          >
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            {badge.label ?? badge.code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={clsx("inline-flex items-center rounded-full px-3 py-1 text-xs font-medium", status.tone)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4">
                      <form action="/api/supplier/confirm" method="post" className="inline-flex gap-2">
                        <input type="hidden" name="orderId" value={order.id ?? ""} />
                        <Button type="submit" name="status" value="confirmed" variant="primary" className="px-3 py-1 text-xs">
                          Confirm
                        </Button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {result.requestId && (
          <p className="text-xs text-slate-300/60">Request ID {result.requestId}</p>
        )}
      </CardGlass>
    </div>
  );
}
