import type { PushDelivery } from "@ecotrips/types";

interface DeliveryLogTableProps {
  deliveries: PushDelivery[];
}

export function DeliveryLogTable({ deliveries }: DeliveryLogTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <table className="w-full table-auto text-left text-xs text-white/70">
        <thead className="bg-white/10 text-white/60">
          <tr>
            <th className="px-4 py-2">Subscription</th>
            <th className="px-4 py-2">Endpoint</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Latency</th>
            <th className="px-4 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.subscription_id} className="border-t border-white/10">
              <td className="px-4 py-2 font-mono text-[11px] text-white/80">{delivery.subscription_id}</td>
              <td className="px-4 py-2 break-all text-white/70">{delivery.endpoint}</td>
              <td className="px-4 py-2 text-white/80">{delivery.status}</td>
              <td className="px-4 py-2 text-white/60">{delivery.latency_ms} ms</td>
              <td className="px-4 py-2 text-rose-200">{delivery.error ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
