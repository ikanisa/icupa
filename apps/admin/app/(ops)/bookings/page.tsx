import { AdminDataTable, CardGlass } from "@ecotrips/ui";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import { getFeatureFlaggedPayload } from "../../../lib/featureFlags";

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

type NormalizedBooking = ReturnType<typeof normalizeBooking>;

const bookingColumns = [
  {
    key: "id",
    header: "Booking",
    className: "pb-3 font-semibold",
    cell: (booking: NormalizedBooking) => booking.id,
  },
  {
    key: "user",
    header: "Traveler / Supplier",
    className: "pb-3",
    cell: (booking: NormalizedBooking) => booking.user,
  },
  {
    key: "status",
    header: "Status",
    className: "pb-3",
    cell: (booking: NormalizedBooking) => <span className="capitalize">{booking.status}</span>,
  },
  {
    key: "total",
    header: "Total",
    className: "pb-3",
    cell: (booking: NormalizedBooking) => booking.total,
  },
  {
    key: "createdAt",
    header: "Created",
    className: "pb-3",
    cell: (booking: NormalizedBooking) => booking.createdAt,
  },
];

export default async function BookingsPage() {
  const result = await loadBookings();
  const hasLiveRows = result.rows.length > 0;
  let usedFixtures = false;
  let rows = result.rows;

  if (!hasLiveRows) {
    const fixture = await getFeatureFlaggedPayload<BookingRecord[]>(
      "OPS_CONSOLE_BOOKINGS_FIXTURES",
      "ops.bookings",
    );
    if (fixture.enabled && Array.isArray(fixture.payload)) {
      rows = fixture.payload;
      usedFixtures = true;
    } else {
      rows = [];
    }
  }

  const display = rows.map(normalizeBooking);

  return (
    <CardGlass title="Bookings" subtitle="Data served via ops-bookings edge function fixtures when offline.">
      {(result.offline || usedFixtures) && (
        <p className="mb-4 text-xs text-amber-200/80">
          {usedFixtures
            ? "Fixture fallback served via OPS_CONSOLE_BOOKINGS_FIXTURES flag while ops-bookings recovers."
            : "Edge function offline — waiting for ops-bookings to recover."}
        </p>
      )}
      {!result.offline && !hasLiveRows && (
        <p className="mb-4 text-sm text-white/70">No bookings match the current filters.</p>
      )}
      <div className="overflow-x-auto">
        <AdminDataTable
          columns={bookingColumns}
          rows={display}
          emptyState={<p className="text-sm text-white/70">No booking records available.</p>}
          getRowKey={(booking) => booking.id}
        />
      </div>
      {result.requestId && (
        <p className="mt-4 text-xs text-white/50">Request ID {result.requestId}</p>
      )}
    </CardGlass>
  );
}
