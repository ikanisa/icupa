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

type ContactTemplateRecord = {
  id?: string;
  label?: string;
  subject?: string;
  body_preview?: string;
  usage_columns?: string[];
  screenshot_hint?: string | null;
};

type ContactTemplate = {
  id: string;
  label: string;
  subject: string;
  bodyPreview: string;
  columns: string[];
  screenshotHint: string | null;
};

const DEFAULT_CONTACT_TEMPLATES: ContactTemplateRecord[] = [
  {
    id: "reconfirm-arrival",
    label: "Reconfirm Arrival Window",
    subject: "Reconfirm arrival for {{booking_id}}",
    body_preview:
      "Hi {{contact_first_name}}, can you confirm the arrival window for booking {{booking_id}} starting {{start_date}}?", 
    usage_columns: ["booking_id", "start_date", "traveler"],
    screenshot_hint: "Drop the Committed column screenshot here before sending.",
  },
  {
    id: "docs-reminder",
    label: "Collect Outstanding Docs",
    subject: "Action needed: documents for {{traveler}}",
    body_preview:
      "We're still missing the compliance packet tracked in the Documents column. Please upload the latest files today.",
    usage_columns: ["documents", "traveler", "supplier"],
    screenshot_hint: "Capture the In Review column rows referenced in the email.",
  },
  {
    id: "blocked-followup",
    label: "Resolve Blocked Ops Task",
    subject: "Help us unblock booking {{booking_id}}",
    body_preview:
      "We're still blocked on the checklist items flagged on the promise board. See the attached screenshot for context.",
    usage_columns: ["promise_column", "owner", "notes"],
    screenshot_hint: "Attach the Blocked column screenshot highlighting owner + notes.",
  },
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

async function loadContactTemplates(): Promise<ContactTemplate[]> {
  const fixture = await getFeatureFlaggedPayload<ContactTemplateRecord[]>(
    "OPS_CONSOLE_BOOKINGS_CONTACT_TEMPLATES",
    "ops.bookings.contact_templates",
  );

  const records = fixture.enabled && Array.isArray(fixture.payload)
    ? fixture.payload
    : DEFAULT_CONTACT_TEMPLATES;

  return records.map((record, index) => normalizeContactTemplate(record, index));
}

function normalizeContactTemplate(
  record: ContactTemplateRecord,
  index: number,
): ContactTemplate {
  const label = typeof record.label === "string" && record.label.trim()
    ? record.label.trim()
    : `Template ${index + 1}`;
  const id = typeof record.id === "string" && record.id.trim()
    ? record.id.trim()
    : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const subject = typeof record.subject === "string" && record.subject.trim()
    ? record.subject.trim()
    : label;
  const bodyPreview = typeof record.body_preview === "string" && record.body_preview.trim()
    ? record.body_preview.trim()
    : "Preview unavailable";
  const columns = Array.isArray(record.usage_columns)
    ? record.usage_columns.map((col) => col.trim()).filter(Boolean)
    : [];
  const screenshotHint = typeof record.screenshot_hint === "string" && record.screenshot_hint.trim()
    ? record.screenshot_hint.trim()
    : null;

  return {
    id,
    label,
    subject,
    bodyPreview,
    columns,
    screenshotHint,
  };
}

export default async function BookingsPage() {
  const [result, contactTemplates] = await Promise.all([
    loadBookings(),
    loadContactTemplates(),
  ]);
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
    <div className="space-y-6">
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
      <CardGlass
        title="Contact Templates"
        subtitle="Sourced from supplier_crm.contact_templates usage_columns for outbound follow-ups"
      >
        <p className="mb-4 text-xs text-white/60">
          Templates highlight which booking columns feed merge tags so ops can capture the right promise board screenshots before sending.
        </p>
        <ul className="space-y-4">
          {contactTemplates.map((template) => (
            <li
              key={template.id}
              className="rounded-lg bg-white/5 p-4"
              data-column-usage={template.columns.join(",")}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">{template.label}</h4>
                  <p className="text-xs text-white/70">{template.subject}</p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] uppercase tracking-wide text-white/60">
                  {template.columns.length} columns
                </span>
              </div>
              <p className="mt-3 text-sm text-white/80">{template.bodyPreview}</p>
              <p className="mt-2 text-xs text-white/60">
                Columns referenced: {template.columns.length > 0
                  ? (
                    <span className="font-medium text-white/70">
                      {template.columns.join(", ")}
                    </span>
                  )
                  : "—"}
              </p>
              <div className="mt-3 rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-center text-[11px] uppercase tracking-wide text-white/50">
                {template.screenshotHint ?? "Attach the latest promise board screenshot before emailing."}
              </div>
            </li>
          ))}
        </ul>
      </CardGlass>
    </div>
  );
}
