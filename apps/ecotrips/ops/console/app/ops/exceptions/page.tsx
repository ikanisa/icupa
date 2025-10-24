import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import exceptionsFixture from "../../../../fixtures/exceptions.json";
import { determineOpsDataMode, readSupabaseConfig } from "../../lib/env";
import { emitBypassAlert } from "../../lib/bypass-alert";
import { createBadgeStyle, createTableStyles, monospaceTextStyle } from "../../lib/ui";
import Pagination from "../components/pagination";

type SearchParams = Record<string, string | string[] | undefined>;

type ExceptionFilters = {
  status?: string;
};

const DEFAULT_PAGE_SIZE = 20;

type FixtureRow = {
  id: string;
  type: string;
  status: string;
  supplier: string;
  last_error: string;
  occurred_at: string;
};

type EdgeRow = {
  id?: string;
  kind?: string;
  status?: string;
  supplier?: string | null;
  last_error?: string | null;
  occurred_at?: string;
  created_at?: string;
};

type ExceptionRow = {
  id: string;
  kind?: string;
  status?: string;
  supplier?: string;
  lastError?: string;
  occurredAt?: string;
  source: "fixtures" | "edge";
};

type ExceptionLoadSuccess = {
  ok: true;
  rows: ExceptionRow[];
  source: "fixtures" | "edge";
  requestId: string | null;
  total: number;
  page: number;
  pageSize: number;
};

type ExceptionLoadError = {
  ok: false;
  message: string;
};

type ExceptionLoadResult = ExceptionLoadSuccess | ExceptionLoadError;

const STATUS_OPTIONS = ["open", "retrying", "resolved"] as const;

export default function ExceptionsPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const filters = extractFilters(searchParams);
  const selectedId = parseSelectedId(searchParams);
  const page = parsePage(searchParams);

  return (
    <section>
      <h1>Exceptions</h1>
      <p>
        Track failed webhooks, partial payments, and supplier rejections with actionable metadata and
        escalation notes.
      </p>

      <FilterControls filters={filters} />
      <Suspense fallback={<p>Loading exceptions…</p>}>
        {/* @ts-ignore -- Async Server Component */}
        <ExceptionsData filters={filters} selectedId={selectedId} page={page} />
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

function extractFilters(searchParams?: SearchParams): ExceptionFilters {
  if (!searchParams) return {};
  const rawStatus = searchParams.status;
  if (Array.isArray(rawStatus)) {
    return rawStatus[0] ? { status: rawStatus[0] } : {};
  }
  return rawStatus && rawStatus.trim() ? { status: rawStatus.trim() } : {};
}

function parseSelectedId(searchParams?: SearchParams): string | undefined {
  if (!searchParams) return undefined;
  const raw = searchParams.selected;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() ? value.trim() : undefined;
}

function FilterControls({ filters }: { filters: ExceptionFilters }) {
  const formStyle: CSSProperties = {
    display: "flex",
    gap: "1rem",
    alignItems: "flex-end",
    marginTop: "1.5rem",
    marginBottom: "1.5rem",
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
        <span>Status</span>
        <select name="status" defaultValue={filters.status ?? ""} style={selectStyle}>
          <option value="">All</option>
          {STATUS_OPTIONS.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button type="submit" style={buttonStyle}>
          Apply
        </button>
        <Link href="/ops/exceptions" style={resetStyle}>
          Reset
        </Link>
      </div>
    </form>
  );
}

async function ExceptionsData(
  { filters, selectedId, page }: { filters: ExceptionFilters; selectedId?: string; page: number },
) {
  const result = await loadExceptions(filters, page);

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
        <p>Unable to load exceptions.</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.9 }}>{result.message}</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return <p style={{ marginTop: "1rem" }}>No exceptions match the selected filters.</p>;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.75rem", opacity: 0.8 }}>
        Showing page {result.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))} ·
        {" "}
        {result.rows.length} of {result.total} exceptions from
        {" "}
        {result.source === "fixtures" ? "offline fixtures" : "Supabase Edge Function"}
        {result.requestId ? ` · request_id ${result.requestId}` : ""}
      </p>
      <ExceptionTable
        rows={result.rows}
        filters={filters}
        selectedId={selectedId}
        page={result.page}
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        buildPageHref={(nextPage) => buildPageLink(filters, nextPage)}
      />
      {selectedId ? renderExceptionDetail(result.rows, selectedId) : null}
    </div>
  );
}

async function loadExceptions(
  filters: ExceptionFilters,
  page: number,
): Promise<ExceptionLoadResult> {
  const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
  const pageSize = DEFAULT_PAGE_SIZE;

  const mode = determineOpsDataMode();
  if (mode.mode === "blocked") {
    await emitBypassAlert({
      page: "exceptions",
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
      page: "exceptions",
      toggles: mode.toggles,
      reason: "Fixture mode requested for exceptions page",
    });
    const allRows = (exceptionsFixture as FixtureRow[]).map((item) => mapFixtureRow(item));
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
  if (filters.status) params.append("status", filters.status);
  params.append("page", String(safePage));
  params.append("page_size", String(pageSize));

  const query = params.toString();
  const requestUrl = `${configState.config.url}/functions/v1/ops-exceptions${
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
      message: `Failed contacting ops-exceptions: ${(error as Error).message}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `ops-exceptions returned ${response.status}`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      message: `Unable to parse ops-exceptions response: ${(error as Error).message}`,
    };
  }

  const parsed = payload as {
    ok?: boolean;
    data?: unknown;
    request_id?: unknown;
    total?: unknown;
    page?: unknown;
    page_size?: unknown;
  };
  if (parsed?.ok !== true || !Array.isArray(parsed.data)) {
    return { ok: false, message: "Unexpected ops-exceptions payload." };
  }

  const rows = (parsed.data as EdgeRow[]).map((row, index) => mapEdgeRow(row, index));
  const total = Number(parsed.total);
  const normalizedTotal = Number.isFinite(total) && total >= 0 ? Math.floor(total) : rows.length;
  const responsePage = Number(parsed.page);
  const normalizedPage = Number.isFinite(responsePage) && responsePage >= 1
    ? Math.floor(responsePage)
    : safePage;
  const responsePageSize = Number(parsed.page_size);
  const normalizedPageSize = Number.isFinite(responsePageSize) && responsePageSize > 0
    ? Math.floor(responsePageSize)
    : pageSize;
  return {
    ok: true,
    rows,
    source: "edge",
    requestId: typeof parsed.request_id === "string" ? parsed.request_id : null,
    total: normalizedTotal,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

function mapFixtureRow(row: FixtureRow): ExceptionRow {
  return {
    id: row.id,
    kind: row.type,
    status: row.status,
    supplier: row.supplier,
    lastError: row.last_error,
    occurredAt: row.occurred_at,
    source: "fixtures",
  };
}

function mapEdgeRow(row: EdgeRow, index: number): ExceptionRow {
  const id = typeof row.id === "string" && row.id ? row.id : `edge-${index}`;
  const kind = typeof row.kind === "string" && row.kind ? row.kind : undefined;
  const status = typeof row.status === "string" ? row.status : undefined;
  const supplier = typeof row.supplier === "string" && row.supplier ? row.supplier : undefined;
  const lastError = typeof row.last_error === "string" && row.last_error
    ? row.last_error
    : undefined;
  const occurredAt = typeof row.occurred_at === "string"
    ? row.occurred_at
    : typeof row.created_at === "string"
    ? row.created_at
    : undefined;

  return {
    id,
    kind,
    status,
    supplier,
    lastError,
    occurredAt,
    source: "edge",
  };
}

function ExceptionTable(
  {
    rows,
    filters,
    selectedId,
    page,
  }:
    { rows: ExceptionRow[]; filters: ExceptionFilters; selectedId?: string; page: number },
) {
  const tableStyles = createTableStyles({ minWidth: "640px" });
  const wrapperStyle = tableStyles.wrapper;
  const tableStyle = tableStyles.table;
  const headCellStyle = tableStyles.headCell;
  const cellStyle = tableStyles.cell;

  const monoStyle = monospaceTextStyle({ fontSize: "0.75rem", opacity: 0.7 });

  return (
    <div style={wrapperStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headCellStyle}>Exception</th>
            <th style={headCellStyle}>Status</th>
            <th style={headCellStyle}>Supplier</th>
            <th style={headCellStyle}>Occurred</th>
            <th style={headCellStyle}>Last Error</th>
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
                  <Link href={buildExceptionLink(row.id, filters, page)}>{row.id}</Link>
                </div>
                {row.kind ? (
                  <div style={monoStyle}>kind: {row.kind}</div>
                ) : null}
                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  {row.source === "fixtures" ? "fixture" : "live"}
                </div>
              </td>
              <td style={cellStyle}>{renderStatus(row.status)}</td>
              <td style={cellStyle}>{row.supplier ?? "—"}</td>
              <td style={cellStyle}>{formatDate(row.occurredAt)}</td>
              <td style={cellStyle}>
                {row.lastError ? (
                  <code style={monoStyle}>{truncate(row.lastError, 96)}</code>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildExceptionLink(id: string, filters: ExceptionFilters, page: number): string {
  const params = createFilterParams(filters);
  params.set("selected", id);
  params.set("page", String(page));
  return `/ops/exceptions?${params.toString()}`;
}

function buildPageLink(filters: ExceptionFilters, page: number): string {
  const params = createFilterParams(filters);
  params.set("page", String(Math.max(1, page)));
  return `/ops/exceptions?${params.toString()}`;
}

function createFilterParams(filters: ExceptionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  return params;
}

function renderStatus(status?: string) {
  if (!status) return "—";
  const normalized = status.toLowerCase();
  const palette: Record<string, { bg: string; fg: string }> = {
    open: { bg: "rgba(248, 113, 113, 0.25)", fg: "#fecaca" },
    retrying: { bg: "rgba(251, 191, 36, 0.25)", fg: "#fde68a" },
    resolved: { bg: "rgba(34, 197, 94, 0.25)", fg: "#bbf7d0" },
  };

  const colors = palette[normalized] ?? {
    bg: "rgba(148, 163, 184, 0.25)",
    fg: "#cbd5f5",
  };

  return <span style={createBadgeStyle(colors)}>{status}</span>;
}

function formatDate(value?: string) {
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

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function renderExceptionDetail(rows: ExceptionRow[], selectedId: string) {
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
      <h3 style={{ marginTop: 0 }}>Exception detail</h3>
      <div>
        <div style={labelStyle}>Kind</div>
        <div style={valueStyle}>{selected.kind ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Status</div>
        <div style={valueStyle}>{renderStatus(selected.status)}</div>
      </div>
      <div>
        <div style={labelStyle}>Supplier</div>
        <div style={valueStyle}>{selected.supplier ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Occurred</div>
        <div style={valueStyle}>{formatDate(selected.occurredAt)}</div>
      </div>
      <div>
        <div style={labelStyle}>Last error</div>
        <div style={{ ...valueStyle, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
          {selected.lastError ?? "—"}
        </div>
      </div>
    </aside>
  );
}
