import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import supplierSlasFixture from "../../../../fixtures/supplier_slas.json";
import { determineOpsDataMode, readSupabaseConfig } from "../../lib/env";
import { emitBypassAlert } from "../../lib/bypass-alert";
import { createBadgeStyle, createTableStyles } from "../../lib/ui";
import Pagination from "../components/pagination";

type SearchParams = Record<string, string | string[] | undefined>;

type SlaFilters = {
  breach?: string;
};

const DEFAULT_PAGE_SIZE = 20;

type FixtureRow = {
  supplier: string;
  tier: string;
  avg_confirmation_hours: number;
  open_confirms: number;
  breach_state: string;
  cancellations_pct: number;
  last_breach_at: string | null;
};

type EdgeRow = {
  supplier?: string | null;
  tier?: string | null;
  avg_confirmation_hours?: number | null;
  open_confirms?: number | null;
  breach_state?: string | null;
  cancellations_pct?: number | null;
  last_breach_at?: string | null;
};

type SupplierRow = {
  supplier: string;
  tier?: string;
  avgHours?: number;
  openConfirms?: number;
  breach?: string;
  cancelPct?: number;
  lastBreach?: string | null;
  source: "fixtures" | "edge";
};

type SupplierLoadSuccess = {
  ok: true;
  rows: SupplierRow[];
  source: "fixtures" | "edge";
  requestId: string | null;
  total: number;
  page: number;
  pageSize: number;
};

type SupplierLoadError = {
  ok: false;
  message: string;
};

type SupplierLoadResult = SupplierLoadSuccess | SupplierLoadError;

const BREACH_OPTIONS = ["on_track", "warning", "breach"] as const;

export default function SupplierSlasPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const filters = extractFilters(searchParams);
  const selected = parseSelectedSupplier(searchParams);
  const page = parsePage(searchParams);

  return (
    <section>
      <h1>Supplier SLAs</h1>
      <p>
        Monitor confirmation cadences, cancellation rates, and breach alerts to proactively manage
        supplier relationships.
      </p>

      <FilterControls filters={filters} />
      <Suspense fallback={<p>Loading supplier SLA metrics…</p>}>
        {/* @ts-expect-error -- Async Server Component */}
        <SupplierSlasData filters={filters} selected={selected} page={page} />
      </Suspense>
    </section>
  );
}

function parsePage(searchParams?: SearchParams): number {
  if (!searchParams) return 1;
  const raw = searchParams.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function extractFilters(searchParams?: SearchParams): SlaFilters {
  if (!searchParams) return {};
  const raw = searchParams.breach;
  if (Array.isArray(raw)) {
    return raw[0] ? { breach: raw[0] } : {};
  }
  return raw && raw.trim() ? { breach: raw.trim() } : {};
}

function parseSelectedSupplier(searchParams?: SearchParams): string | undefined {
  if (!searchParams) return undefined;
  const raw = searchParams.selected;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() ? value.trim() : undefined;
}

function FilterControls({ filters }: { filters: SlaFilters }) {
  const formStyle: CSSProperties = {
    display: "flex",
    gap: "1rem",
    alignItems: "flex-end",
    marginTop: "1.5rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  };

  const selectStyle: CSSProperties = {
    padding: "0.45rem 0.7rem",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    background: "rgba(15, 23, 42, 0.35)",
    color: "inherit",
  };

  const labelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
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
      <label style={labelStyle}>
        <span>Breach state</span>
        <select name="breach" defaultValue={filters.breach ?? ""} style={selectStyle}>
          <option value="">All</option>
          {BREACH_OPTIONS.map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" style={buttonStyle}>
          Apply
        </button>
        <Link href="/ops/supplier-slas" style={resetStyle}>
          Reset
        </Link>
      </div>
    </form>
  );
}

async function SupplierSlasData(
  { filters, selected, page }: { filters: SlaFilters; selected?: string; page: number },
) {
  const result = await loadSupplierMetrics(filters, page);

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
        <p>Unable to load supplier SLA metrics.</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.9 }}>{result.message}</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return <p style={{ marginTop: "1rem" }}>No suppliers match the selected filters.</p>;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.75rem", opacity: 0.8 }}>
        Showing page {result.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))} ·
        {" "}
        {result.rows.length} of {result.total} suppliers sourced from
        {" "}
        {result.source === "fixtures" ? "offline fixtures" : "Supabase view"}
        {result.requestId ? ` · request_id ${result.requestId}` : ""}
      </p>
      <SupplierTable
        rows={result.rows}
        filters={filters}
        selected={selected}
        page={result.page}
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        buildPageHref={(nextPage) => buildPageLink(filters, nextPage)}
      />
      {selected ? renderSupplierDetail(result.rows, selected) : null}
    </div>
  );
}

async function loadSupplierMetrics(
  filters: SlaFilters,
  page: number,
): Promise<SupplierLoadResult> {
  const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const mode = determineOpsDataMode();
  if (mode.mode === "blocked") {
    await emitBypassAlert({
      page: "supplier-slas",
      toggles: mode.toggles,
      reason: mode.reason,
    });
    return {
      ok: false,
      message: `${mode.reason} Disable toggles: ${mode.toggles.join(', ')}`.trim(),
    };
  }

  if (mode.mode === "fixtures") {
    await emitBypassAlert({
      page: "supplier-slas",
      toggles: mode.toggles,
      reason: "Fixture mode requested for supplier SLAs page",
    });
    const allRows = (supplierSlasFixture as FixtureRow[]).map((item) => mapFixtureRow(item));
    const total = allRows.length;
    const start = (safePage - 1) * pageSize;
    const rows = allRows.slice(start, start + pageSize);
    return {
      ok: true,
      rows,
      source: "fixtures",
      requestId: null,
      total,
      page: safePage,
      pageSize,
    };
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
  params.set(
    "select",
    "supplier,tier,avg_confirmation_hours,open_confirms,breach_state,cancellations_pct,last_breach_at",
  );
  if (filters.breach) {
    params.append("breach_state", `eq.${filters.breach}`);
  }

  const requestUrl = `${configState.config.url}/rest/v1/ops.v_supplier_slas?${params.toString()}`;
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize - 1;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      headers: {
        apikey: configState.config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "count=exact",
        Range: `${start}-${end}`,
      },
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      message: `Failed contacting ops.v_supplier_slas: ${(error as Error).message}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `ops.v_supplier_slas returned ${response.status}`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      message: `Unable to parse ops.v_supplier_slas response: ${(error as Error).message}`,
    };
  }

  if (!Array.isArray(payload)) {
    return { ok: false, message: "Unexpected ops.v_supplier_slas payload." };
  }

  const rows = (payload as EdgeRow[]).map((row) => mapEdgeRow(row));
  const totalHeader = response.headers.get("content-range");
  const total = parseContentRangeTotal(totalHeader);
  const normalizedTotal = typeof total === "number" ? total : Math.max(rows.length + start, rows.length);
  return {
    ok: true,
    rows,
    source: "edge",
    requestId: null,
    total: normalizedTotal,
    page: safePage,
    pageSize,
  };
}

function mapFixtureRow(row: FixtureRow): SupplierRow {
  return {
    supplier: row.supplier,
    tier: row.tier,
    avgHours: row.avg_confirmation_hours,
    openConfirms: row.open_confirms,
    breach: row.breach_state,
    cancelPct: row.cancellations_pct,
    lastBreach: row.last_breach_at,
    source: "fixtures",
  };
}

function mapEdgeRow(row: EdgeRow): SupplierRow {
  return {
    supplier: typeof row.supplier === "string" && row.supplier ? row.supplier : "(unknown)",
    tier: typeof row.tier === "string" && row.tier ? row.tier : undefined,
    avgHours: typeof row.avg_confirmation_hours === "number"
      ? row.avg_confirmation_hours
      : undefined,
    openConfirms: typeof row.open_confirms === "number"
      ? row.open_confirms
      : undefined,
    breach: typeof row.breach_state === "string" && row.breach_state
      ? row.breach_state
      : undefined,
    cancelPct: typeof row.cancellations_pct === "number"
      ? row.cancellations_pct
      : undefined,
    lastBreach: typeof row.last_breach_at === "string" || row.last_breach_at === null
      ? row.last_breach_at
      : null,
    source: "edge",
  };
}

function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const match = /\/(\d+)$/u.exec(header.trim());
  if (!match) return null;
  const total = Number(match[1]);
  if (!Number.isFinite(total) || total < 0) return null;
  return Math.floor(total);
}

function SupplierTable(
  {
    rows,
    filters,
    selected,
    page,
  }:
    { rows: SupplierRow[]; filters: SlaFilters; selected?: string; page: number },
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
            <th style={headCellStyle}>Supplier</th>
            <th style={headCellStyle}>Tier</th>
            <th style={headCellStyle}>Avg Confirmation (hrs)</th>
            <th style={headCellStyle}>Open Confirms</th>
            <th style={headCellStyle}>Breach</th>
            <th style={headCellStyle}>Cancellation %</th>
            <th style={headCellStyle}>Last Breach</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.supplier}
              style={row.supplier === selected
                ? { background: "rgba(34, 211, 238, 0.12)" }
                : undefined}
            >
              <td style={cellStyle}>
                <div style={{ fontWeight: 600 }}>
                  <Link href={buildSupplierLink(row.supplier, filters, page)}>{row.supplier}</Link>
                </div>
                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  {row.source === "fixtures" ? "fixture" : "live"}
                </div>
              </td>
              <td style={cellStyle}>{row.tier ?? "—"}</td>
              <td style={cellStyle}>{formatHours(row.avgHours)}</td>
              <td style={cellStyle}>{row.openConfirms ?? "—"}</td>
              <td style={cellStyle}>{renderBreach(row.breach)}</td>
              <td style={cellStyle}>{formatPercent(row.cancelPct)}</td>
              <td style={cellStyle}>{formatDateTime(row.lastBreach ?? undefined)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildSupplierLink(name: string, filters: SlaFilters, page: number): string {
  const params = createFilterParams(filters);
  params.set("selected", name);
  params.set("page", String(page));
  return `/ops/supplier-slas?${params.toString()}`;
}

function buildPageLink(filters: SlaFilters, page: number): string {
  const params = createFilterParams(filters);
  params.set("page", String(Math.max(1, page)));
  return `/ops/supplier-slas?${params.toString()}`;
}

function createFilterParams(filters: SlaFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.breach) params.set("breach", filters.breach);
  return params;
}

function formatHours(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

function renderBreach(breach?: string) {
  if (!breach) return "—";
  const normalized = breach.toLowerCase();
  const palette: Record<string, { bg: string; fg: string }> = {
    on_track: { bg: "rgba(34, 197, 94, 0.25)", fg: "#bbf7d0" },
    warning: { bg: "rgba(250, 204, 21, 0.25)", fg: "#fde68a" },
    breach: { bg: "rgba(239, 68, 68, 0.25)", fg: "#fecaca" },
  };

  const colors = palette[normalized] ?? {
    bg: "rgba(148, 163, 184, 0.25)",
    fg: "#cbd5f5",
  };

  return <span style={createBadgeStyle(colors)}>{breach}</span>;
}

function formatPercent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  try {
    return parsed.toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_error) {
    return value;
  }
}

function renderSupplierDetail(rows: SupplierRow[], selected: string) {
  const supplier = rows.find((row) => row.supplier === selected);
  if (!supplier) return null;

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
      <h3 style={{ marginTop: 0 }}>Supplier detail</h3>
      <div>
        <div style={labelStyle}>Tier</div>
        <div style={valueStyle}>{supplier.tier ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Average confirmation</div>
        <div style={valueStyle}>
          {(() => {
            const hours = formatHours(supplier.avgHours);
            return hours === "—" ? hours : `${hours} hrs`;
          })()}
        </div>
      </div>
      <div>
        <div style={labelStyle}>Open confirmations</div>
        <div style={valueStyle}>{supplier.openConfirms ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Breach status</div>
        <div style={valueStyle}>{renderBreach(supplier.breach)}</div>
      </div>
      <div>
        <div style={labelStyle}>Cancellation rate</div>
        <div style={valueStyle}>{formatPercent(supplier.cancelPct)}</div>
      </div>
      <div>
        <div style={labelStyle}>Last breach</div>
        <div style={valueStyle}>{formatDateTime(supplier.lastBreach ?? undefined)}</div>
      </div>
    </aside>
  );
}
