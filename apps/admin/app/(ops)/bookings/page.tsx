import { CardGlass } from "@ecotrips/ui";

import { getOpsFunctionClient } from "../../../lib/functionClient";

type BookingRecord = Record<string, unknown> & {
  id?: string;
  itinerary_id?: string;
  traveler?: string;
  user?: string;
  status?: string;
  total_cents?: number | null;
  currency?: string | null;
  total?: string | number | null;
  created_at?: string | null;
  createdAt?: string | null;
  start_date?: string | null;
  supplier?: string | null;
  primary_supplier?: string | null;
};

type LoadedBookings = {
  rows: BookingRecord[];
  requestId?: string;
  offline: boolean;
};

const fallbackBookings: BookingRecord[] = [
  { id: "BK-1021", user: "jane@traveler.com", status: "confirmed", total: "$1,820", createdAt: "2024-05-04" },
  { id: "BK-1022", user: "yves@rwanda.rw", status: "pending", total: "$2,410", createdAt: "2024-05-04" },
  { id: "BK-1012", user: "amina@ecotrips.africa", status: "refunded", total: "$860", createdAt: "2024-05-01" },
];

async function loadBookings(): Promise<LoadedBookings> {
  try {
    const client = await getOpsFunctionClient();
    if (!client) {
      return { rows: [], offline: true };
    }

    const response = await client.call("ops.bookings", { page: 1, page_size: 20 });
    return {
      rows: Array.isArray(response.data) ? (response.data as BookingRecord[]) : [],
      requestId: response.request_id,
      offline: !response.ok,
    };
  } catch (error) {
    console.error("ops.bookings failed", error);
    return { rows: [], offline: true };
  }
}

function normalizeBooking(record: BookingRecord) {
  const id = record.id ?? record.itinerary_id ?? "—";
  const user = record.traveler ?? record.user ?? record.primary_supplier ?? record.supplier ?? "—";
  const status = record.status ?? "pending";

  const totalCents = typeof record.total_cents === "number" && Number.isFinite(record.total_cents)
    ? record.total_cents
    : null;
  const currency = typeof record.currency === "string" && record.currency ? record.currency : "USD";
  let total: string;
  if (totalCents !== null) {
    total = `${currency} ${(totalCents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else if (typeof record.total === "number") {
    total = record.total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (typeof record.total === "string") {
    total = record.total;
  } else {
    total = "—";
  }

  const createdRaw = record.created_at ?? record.createdAt ?? record.start_date ?? null;
  let createdAt = "—";
  if (typeof createdRaw === "string" && createdRaw) {
    const parsed = new Date(createdRaw);
    createdAt = Number.isNaN(parsed.getTime()) ? createdRaw : parsed.toISOString().slice(0, 10);
  }

  return {
    id: String(id),
    user,
    status,
    total,
    createdAt,
  };
}

export default async function BookingsPage() {
  const result = await loadBookings();
  const hasLiveRows = result.rows.length > 0;
  const rows = hasLiveRows ? result.rows : result.offline ? fallbackBookings : [];
  const display = rows.map(normalizeBooking);

  return (
    <CardGlass title="Bookings" subtitle="Data served via ops-bookings edge function fixtures when offline.">
      {result.offline && (
        <p className="mb-4 text-xs text-amber-200/80">
          Edge function offline — falling back to fixtures while structured logs capture outage details.
        </p>
      )}
      {!result.offline && !hasLiveRows && (
        <p className="mb-4 text-sm text-white/70">No bookings match the current filters.</p>
      )}
      <div className="overflow-x-auto">
        {display.length > 0 ? (
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-300/80">
                <th className="pb-3">Booking</th>
                <th className="pb-3">Traveler / Supplier</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Total</th>
                <th className="pb-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {display.map((booking) => (
                <tr key={booking.id}>
                  <td className="py-3 font-semibold">{booking.id}</td>
                  <td className="py-3">{booking.user}</td>
                  <td className="py-3 capitalize">{booking.status}</td>
                  <td className="py-3">{booking.total}</td>
                  <td className="py-3">{booking.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-white/70">No booking records available.</p>
        )}
      </div>
      {result.requestId && (
        <p className="mt-4 text-xs text-white/50">Request ID {result.requestId}</p>
      )}
    </CardGlass>
  );
}
