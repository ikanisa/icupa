import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import bookingsFixture from "../../../../fixtures/bookings.json";
import { opsConsoleOfflineModeEnabled, readSupabaseConfig } from "../../lib/env";
import { createBadgeStyle, createTableStyles } from "../../lib/ui";

type SearchParams = Record<string, string | string[] | undefined>;

type ManifestFilters = {
  from?: string;
  to?: string;
  supplier?: string;
};

type FixtureRow = {
  id: string;
  itinerary_id: string;
  supplier: string;
  start_date: string;
  end_date: string;
  traveler: string;
  status: string;
  inventory_note?: string;
};

type EdgeRow = {
  id?: string;
  itinerary_id?: string | null;
  created_at?: string;
  status?: string;
  total_cents?: number;
  currency?: string;
  has_items?: boolean;
  primary_supplier?: string | null;
};

type ManifestRow = {
  id: string;
  itineraryId?: string;
  primaryDate?: string;
  secondaryDate?: string;
  supplier?: string;
  traveler?: string;
  status?: string;
  totalCents?: number;
  currency?: string;
  hasItems?: boolean;
  source: "fixtures" | "edge";
  inventoryNote?: string | null;
};

type ManifestLoadSuccess = {
  ok: true;
  rows: ManifestRow[];
  source: "fixtures" | "edge";
  requestId: string | null;
};

type ManifestLoadError = {
  ok: false;
  message: string;
};

type ManifestLoadResult = ManifestLoadSuccess | ManifestLoadError;

export default function ManifestsPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const filters = extractFilters(searchParams);
  const selectedId = parseSelectedId(searchParams);

  return (
    <section>
      <h1>Manifests</h1>
      <p>Upcoming bookings with supplier/date filters and traveler voucher details.</p>
      <ul>
        <li>Table: booking manifests with filter controls.</li>
        <li>Detail drawer: traveler context, vouchers, contact points.</li>
        <li>Action toolbar: mark ready, issue reminders.</li>
        <li>Toast notifications for status updates.</li>
      </ul>

      <FilterControls filters={filters} />
      <Suspense fallback={<p>Loading manifests…</p>}>
        {/* @ts-ignore -- Async Server Component */}
        <ManifestsData filters={filters} selectedId={selectedId} />
      </Suspense>
    </section>
  );
}

function extractFilters(searchParams?: SearchParams): ManifestFilters {
  if (!searchParams) return {};

  const pick = (key: string) => {
    const raw = searchParams[key];
    if (Array.isArray(raw)) return raw[0];
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  };

  const filters: ManifestFilters = {};
  const from = pick("from");
  const to = pick("to");
  const supplier = pick("supplier");

  if (from) filters.from = from;
  if (to) filters.to = to;
  if (supplier) filters.supplier = supplier;
  return filters;
}

function parseSelectedId(searchParams?: SearchParams): string | undefined {
  if (!searchParams) return undefined;
  const raw = searchParams.selected;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() ? value.trim() : undefined;
}

function FilterControls({ filters }: { filters: ManifestFilters }) {
  const fieldStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  };

  const formStyle: CSSProperties = {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
    marginTop: "1.5rem",
    marginBottom: "1.5rem",
    alignItems: "flex-end",
  };

  const inputStyle: CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    background: "rgba(15, 23, 42, 0.35)",
    color: "inherit",
  };

  const buttonStyle: CSSProperties = {
    padding: "0.5rem 0.85rem",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.6)",
    background: "rgba(30, 58, 138, 0.65)",
    color: "#e2e8f0",
    cursor: "pointer",
  };

  const resetStyle: CSSProperties = {
    padding: "0.5rem 0.85rem",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.35)",
    background: "transparent",
    color: "inherit",
  };

  return (
    <form method="get" style={formStyle}>
      <label style={fieldStyle}>
        <span>From</span>
        <input
          type="date"
          name="from"
          defaultValue={filters.from ?? ""}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        <span>To</span>
        <input
          type="date"
          name="to"
          defaultValue={filters.to ?? ""}
          style={inputStyle}
        />
      </label>
      <label style={fieldStyle}>
        <span>Supplier</span>
        <input
          type="text"
          name="supplier"
          placeholder="supplier code"
          defaultValue={filters.supplier ?? ""}
          style={inputStyle}
          maxLength={64}
        />
      </label>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" style={buttonStyle}>
          Apply
        </button>
        <Link href="/ops/manifests" style={resetStyle}>
          Reset
        </Link>
      </div>
    </form>
  );
}

async function ManifestsData(
  { filters, selectedId }: { filters: ManifestFilters; selectedId?: string },
) {
  const result = await loadManifests(filters);

  if (!result.ok) {
    return (
      <div
        role="alert"
        style={{
          marginTop: "1rem",
          padding: "1rem",
          borderRadius: "12px",
          border: "1px solid rgba(248, 113, 113, 0.45)",
          background: "rgba(127, 29, 29, 0.25)",
        }}
      >
        <p>Unable to load manifests.</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.9 }}>{result.message}</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return <p style={{ marginTop: "1rem" }}>No manifests match the selected filters.</p>;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.75rem", opacity: 0.8 }}>
        Showing {result.rows.length} booking
        {result.rows.length === 1 ? "" : "s"} from
        {" "}
        {result.source === "fixtures" ? "offline fixtures" : "Supabase Edge Function"}
        {result.requestId ? ` · request_id ${result.requestId}` : ""}
      </p>
      <ManifestTable rows={result.rows} filters={filters} selectedId={selectedId} />
      {selectedId ? renderManifestDetail(result.rows, selectedId) : null}
    </div>
  );
}

async function loadManifests(filters: ManifestFilters): Promise<ManifestLoadResult> {
  if (opsConsoleOfflineModeEnabled()) {
    const rows = (bookingsFixture as FixtureRow[]).map((item) => mapFixtureRow(item));
    return { ok: true, rows, source: "fixtures", requestId: null };
  }

  const configState = readSupabaseConfig();
  if (!configState.ok) {
    return {
      ok: false,
      message: `Missing Supabase env: ${configState.missing.join(", ")}`,
    };
  }

  const accessToken = cookies().get("sb-access-token")?.value;
  if (!accessToken) {
    return {
      ok: false,
      message: "Supabase session cookie missing. Sign in again to continue.",
    };
  }

  const params = new URLSearchParams();
  if (filters.from) params.append("from", filters.from);
  if (filters.to) params.append("to", filters.to);
  if (filters.supplier) params.append("supplier", filters.supplier);

  const query = params.toString();
  const requestUrl = `${configState.config.url}/functions/v1/ops-bookings${
    query ? `?${query}` : ""
  }`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      headers: {
        apikey: configState.config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      message: `Failed contacting ops-bookings: ${(error as Error).message}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `ops-bookings returned ${response.status}`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      message: `Unable to parse ops-bookings response: ${(error as Error).message}`,
    };
  }

  const parsed = payload as { ok?: boolean; data?: unknown; request_id?: unknown };
  if (parsed?.ok !== true || !Array.isArray(parsed.data)) {
    return { ok: false, message: "Unexpected ops-bookings payload." };
  }

  const rows = (parsed.data as EdgeRow[]).map((row, index) => mapEdgeRow(row, index));
  return {
    ok: true,
    rows,
    source: "edge",
    requestId: typeof parsed.request_id === "string" ? parsed.request_id : null,
  };
}

function mapFixtureRow(row: FixtureRow): ManifestRow {
  return {
    id: row.id,
    itineraryId: row.itinerary_id,
    primaryDate: row.start_date,
    secondaryDate: row.end_date,
    supplier: row.supplier,
    traveler: row.traveler,
    status: row.status,
    inventoryNote: row.inventory_note ?? null,
    source: "fixtures",
  };
}

function mapEdgeRow(row: EdgeRow, index: number): ManifestRow {
  const id = typeof row.id === "string" && row.id ? row.id : `edge-${index}`;
  const itineraryId = typeof row.itinerary_id === "string" && row.itinerary_id
    ? row.itinerary_id
    : undefined;
  const supplier = typeof row.primary_supplier === "string" && row.primary_supplier
    ? row.primary_supplier
    : undefined;
  const status = typeof row.status === "string" ? row.status : undefined;
  const totalCents = typeof row.total_cents === "number" ? row.total_cents : undefined;
  const currency = typeof row.currency === "string" ? row.currency : undefined;
  const hasItems = typeof row.has_items === "boolean" ? row.has_items : undefined;
  const inventoryNote = typeof (row as { inventory_note?: unknown }).inventory_note === "string"
    ? (row as { inventory_note?: string }).inventory_note
    : typeof (row as { inventory_summary?: unknown }).inventory_summary === "string"
    ? (row as { inventory_summary?: string }).inventory_summary
    : undefined;

  return {
    id,
    itineraryId,
    primaryDate: typeof row.created_at === "string" ? row.created_at : undefined,
    supplier,
    status,
    totalCents,
    currency,
    hasItems,
    inventoryNote: inventoryNote ?? null,
    source: "edge",
  };
}

function ManifestTable(
  {
    rows,
    filters,
    selectedId,
  }:
    { rows: ManifestRow[]; filters: ManifestFilters; selectedId?: string },
) {
  const tableStyles = createTableStyles({ minWidth: "720px" });
  const wrapperStyle = tableStyles.wrapper;
  const tableStyle = tableStyles.table;
  const headCellStyle = tableStyles.headCell;
  const cellStyle = tableStyles.cell;

  return (
    <div style={wrapperStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headCellStyle}>Booking</th>
            <th style={headCellStyle}>Dates</th>
            <th style={headCellStyle}>Supplier</th>
            <th style={headCellStyle}>Traveler / Items</th>
            <th style={headCellStyle}>Status</th>
            <th style={headCellStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              style={row.id === selectedId
                ? { background: "rgba(37, 99, 235, 0.12)" }
                : undefined}
            >
              <td style={cellStyle}>
                <div style={{ fontWeight: 600 }}>
                  <Link href={buildManifestLink(row.id, filters)}>{row.id}</Link>
                </div>
                {row.itineraryId ? (
                  <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                    Itinerary {row.itineraryId}
                  </div>
                ) : null}
                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  {row.source === "fixtures" ? "fixture" : "live"}
                </div>
              </td>
              <td style={cellStyle}>
                <div>{formatDate(row.primaryDate)}</div>
                {row.secondaryDate ? (
                  <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                    End {formatDate(row.secondaryDate)}
                  </div>
                ) : null}
              </td>
              <td style={cellStyle}>{row.supplier ?? "—"}</td>
              <td style={cellStyle}>
                {row.traveler
                  ? row.traveler
                  : row.hasItems !== undefined
                  ? row.hasItems
                    ? "items linked"
                    : "no items"
                  : "—"}
              </td>
              <td style={cellStyle}>{renderStatus(row.status)}</td>
              <td style={cellStyle}>{formatCurrency(row.totalCents, row.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderStatus(status?: string) {
  if (!status) return "—";
  const normalized = status.toLowerCase();
  const palette: Record<string, { bg: string; fg: string }> = {
    confirmed: {
      bg: "rgba(34, 197, 94, 0.25)",
      fg: "#bbf7d0",
    },
    pending: {
      bg: "rgba(251, 191, 36, 0.25)",
      fg: "#fde68a",
    },
    cancelled: {
      bg: "rgba(239, 68, 68, 0.25)",
      fg: "#fecaca",
    },
  };
  const colors = palette[normalized] ?? {
    bg: "rgba(148, 163, 184, 0.25)",
    fg: "#cbd5f5",
  };

  return <span style={createBadgeStyle(colors)}>{status}</span>;
}

function buildManifestLink(id: string, filters: ManifestFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.supplier) params.set("supplier", filters.supplier);
  params.set("selected", id);
  return `/ops/manifests?${params.toString()}`;
}

function renderManifestDetail(rows: ManifestRow[], selectedId: string) {
  const selected = rows.find((row) => row.id === selectedId);
  if (!selected) return null;

  const cardStyle: CSSProperties = {
    marginTop: "1.5rem",
    padding: "1.25rem",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    background: "rgba(15, 23, 42, 0.35)",
  };

  const labelStyle: CSSProperties = {
    fontSize: "0.75rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.65,
    marginBottom: "0.15rem",
  };

  const valueStyle: CSSProperties = {
    marginBottom: "0.75rem",
  };

  return (
    <aside style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Manifest detail</h3>
      <div>
        <div style={labelStyle}>Status</div>
        <div style={valueStyle}>{renderStatus(selected.status)}</div>
      </div>
      <div>
        <div style={labelStyle}>Primary supplier</div>
        <div style={valueStyle}>{selected.supplier ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Itinerary</div>
        <div style={valueStyle}>{selected.itineraryId ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Dates</div>
        <div style={valueStyle}>
          {formatDate(selected.primaryDate)}
          {selected.secondaryDate ? ` → ${formatDate(selected.secondaryDate)}` : ""}
        </div>
      </div>
      <div>
        <div style={labelStyle}>Traveler / Items</div>
        <div style={valueStyle}>
          {selected.traveler
            ? selected.traveler
            : selected.hasItems !== undefined
            ? selected.hasItems ? "items linked" : "no items"
            : "—"}
        </div>
      </div>
      <div>
        <div style={labelStyle}>Total</div>
        <div style={valueStyle}>{formatCurrency(selected.totalCents, selected.currency)}</div>
      </div>
      {selected.inventoryNote ? (
        <div>
          <div style={labelStyle}>Inventory</div>
          <div style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>
            {selected.inventoryNote}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  try {
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch (_error) {
    return value;
  }
}

function formatCurrency(totalCents?: number, currency?: string) {
  if (typeof totalCents !== "number" || !Number.isFinite(totalCents) || totalCents <= 0) {
    return "—";
  }
  const normalizedCurrency = currency && /^[A-Z]{3}$/.test(currency)
    ? currency
    : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(totalCents / 100);
  } catch (_error) {
    return `${normalizedCurrency} ${(totalCents / 100).toFixed(2)}`;
  }
}
