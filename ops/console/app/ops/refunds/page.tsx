import { Suspense, type CSSProperties } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import refundsFixture from "../../../../fixtures/refunds.json";
import {
  opsConsoleOfflineModeEnabled,
  readSupabaseConfig,
} from "../../lib/env";
import { createBadgeStyle, createTableStyles, monospaceTextStyle } from "../../lib/ui";
import Pagination from "../components/pagination";

type SearchParams = Record<string, string | string[] | undefined>;

type RefundFilters = {
  status?: string;
};

const DEFAULT_PAGE_SIZE = 20;

type FixtureRow = {
  id: string;
  itinerary_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  reason: string;
  requested_at: string;
  processed_at: string | null;
};

type EdgeRow = {
  id?: string;
  itinerary_id?: string | null;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  reason?: string | null;
  requested_at?: string | null;
  processed_at?: string | null;
};

type RefundRow = {
  id: string;
  itineraryId?: string;
  amountCents?: number;
  currency?: string;
  status?: string;
  reason?: string;
  requestedAt?: string;
  processedAt?: string | null;
  source: "fixtures" | "edge";
};

type RefundLoadSuccess = {
  ok: true;
  rows: RefundRow[];
  source: "fixtures" | "edge";
  requestId: string | null;
  total: number;
  page: number;
  pageSize: number;
};

type RefundLoadError = {
  ok: false;
  message: string;
};

type RefundLoadResult = RefundLoadSuccess | RefundLoadError;

type Notice = {
  kind: "success" | "error" | "simulated";
  message: string;
};

const STATUS_OPTIONS = [
  "processing",
  "succeeded",
  "failed",
  "refunded",
  "voided",
] as const;

export default function RefundsPage({
  searchParams
}: {
  searchParams?: SearchParams;
}) {
  const filters = extractFilters(searchParams);
  const notice = parseNotice(searchParams);
  const selectedId = parseSelectedId(searchParams);
  const page = parsePage(searchParams);

  return (
    <section>
      <h1>Refunds & Credits</h1>
      <p>
        Create credit notes, monitor refund progress, and surface finance-ready summaries from a
        single ledger view.
      </p>

      {notice ? <NoticeBanner notice={notice} /> : null}

      <FilterControls filters={filters} />

      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Initiate Refund</h2>
        {/* @ts-ignore -- Async Server Action binding */}
        <RefundForm filters={filters} page={page} />
      </div>

      <Suspense fallback={<p>Loading refund ledger…</p>}>
        {/* @ts-ignore -- Async Server Component */}
        <RefundsData filters={filters} selectedId={selectedId} page={page} />
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

function extractFilters(searchParams?: SearchParams): RefundFilters {
  if (!searchParams) return {};
  const rawStatus = searchParams.status;
  if (Array.isArray(rawStatus)) {
    return rawStatus[0] ? { status: rawStatus[0] } : {};
  }
  return rawStatus && rawStatus.trim() ? { status: rawStatus.trim() } : {};
}

function parseNotice(searchParams?: SearchParams): Notice | null {
  if (!searchParams) return null;
  const resultRaw = searchParams.result;
  const messageRaw = searchParams.message;
  const requestIdRaw = searchParams.request_id;

  const result = Array.isArray(resultRaw) ? resultRaw[0] : resultRaw;
  const message = Array.isArray(messageRaw) ? messageRaw[0] : messageRaw;
  const requestId = Array.isArray(requestIdRaw) ? requestIdRaw[0] : requestIdRaw;

  if (result === "success") {
    const detail = requestId ? `request_id ${requestId}` : "refund request sent";
    return { kind: "success", message: detail };
  }
  if (result === "simulated") {
    return {
      kind: "simulated",
      message: "Offline mode: refund request simulated without Supabase call.",
    };
  }
  if (result === "error" && message) {
    try {
      return {
        kind: "error",
        message: decodeURIComponent(message),
      };
    } catch (_error) {
      return {
        kind: "error",
        message: message,
      };
    }
  }
  return null;
}

function parseSelectedId(searchParams?: SearchParams): string | undefined {
  if (!searchParams) return undefined;
  const raw = searchParams.selected;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() ? value.trim() : undefined;
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const palette: Record<Notice["kind"], { bg: string; border: string }> = {
    success: { bg: "rgba(22, 163, 74, 0.18)", border: "rgba(21, 128, 61, 0.55)" },
    simulated: { bg: "rgba(30, 64, 175, 0.18)", border: "rgba(37, 99, 235, 0.45)" },
    error: { bg: "rgba(185, 28, 28, 0.2)", border: "rgba(239, 68, 68, 0.6)" },
  };
  const colors = palette[notice.kind];

  return (
    <div
      role="status"
      style={{
        marginTop: "1rem",
        marginBottom: "1.5rem",
        padding: "0.85rem 1rem",
        borderRadius: "12px",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      {notice.message}
    </div>
  );
}

function FilterControls({ filters }: { filters: RefundFilters }) {
  const formStyle: CSSProperties = {
    display: "flex",
    gap: "1rem",
    alignItems: "flex-end",
    marginTop: "1.5rem",
    marginBottom: "1.75rem",
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
        <Link href="/ops/refunds" style={resetStyle}>
          Reset
        </Link>
      </div>
    </form>
  );
}

async function RefundsData(
  { filters, selectedId, page }: { filters: RefundFilters; selectedId?: string; page: number },
) {
  const result = await loadRefunds(filters, page);

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
        <p>Unable to load refund ledger.</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.9 }}>{result.message}</p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return <p style={{ marginTop: "1rem" }}>No refunds match the selected filters.</p>;
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: "0.85rem", marginBottom: "0.75rem", opacity: 0.8 }}>
        Showing page {result.page} of {Math.max(1, Math.ceil(result.total / result.pageSize))} ·
        {" "}
        {result.rows.length} of {result.total} refunds sourced from
        {" "}
        {result.source === "fixtures" ? "offline fixtures" : "Supabase view"}
        {result.requestId ? ` · request_id ${result.requestId}` : ""}
      </p>
      <RefundTable
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
      {selectedId ? renderRefundDetail(result.rows, selectedId) : null}
    </div>
  );
}

async function loadRefunds(
  filters: RefundFilters,
  page: number,
): Promise<RefundLoadResult> {
  const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
  const pageSize = DEFAULT_PAGE_SIZE;

  if (opsConsoleOfflineModeEnabled()) {
    const allRows = (refundsFixture as FixtureRow[]).map((item) => mapFixtureRow(item));
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
    "id,itinerary_id,amount_cents,currency,status,reason,requested_at,processed_at",
  );
  if (filters.status) {
    params.append("status", `eq.${filters.status}`);
  }

  const requestUrl = `${configState.config.url}/rest/v1/ops.v_refunds?${params.toString()}`;
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
      message: `Failed contacting ops.v_refunds: ${(error as Error).message}`,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `ops.v_refunds returned ${response.status}`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      ok: false,
      message: `Unable to parse ops.v_refunds response: ${(error as Error).message}`,
    };
  }

  if (!Array.isArray(payload)) {
    return { ok: false, message: "Unexpected ops.v_refunds payload." };
  }

  const rows = (payload as EdgeRow[]).map((row, index) => mapEdgeRow(row, index));
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

function mapFixtureRow(row: FixtureRow): RefundRow {
  return {
    id: row.id,
    itineraryId: row.itinerary_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    source: "fixtures",
  };
}

function mapEdgeRow(row: EdgeRow, index: number): RefundRow {
  const id = typeof row.id === "string" && row.id ? row.id : `edge-${index}`;
  const itineraryId = typeof row.itinerary_id === "string" && row.itinerary_id
    ? row.itinerary_id
    : undefined;
  const amountCents = typeof row.amount_cents === "number"
    ? row.amount_cents
    : undefined;
  const currency = typeof row.currency === "string" && row.currency ? row.currency : undefined;
  const status = typeof row.status === "string" && row.status ? row.status : undefined;
  const reason = typeof row.reason === "string" && row.reason ? row.reason : undefined;
  const requestedAt = typeof row.requested_at === "string"
    ? row.requested_at
    : undefined;
  const processedAt = typeof row.processed_at === "string" || row.processed_at === null
    ? row.processed_at
    : undefined;

  return {
    id,
    itineraryId,
    amountCents,
    currency,
    status,
    reason,
    requestedAt,
    processedAt: processedAt ?? null,
    source: "edge",
  };
}

function RefundTable(
  {
    rows,
    filters,
    selectedId,
    page,
  }:
    { rows: RefundRow[]; filters: RefundFilters; selectedId?: string; page: number },
) {
  const tableStyles = createTableStyles({ minWidth: "760px" });
  const wrapperStyle = tableStyles.wrapper;
  const tableStyle = tableStyles.table;
  const headCellStyle = tableStyles.headCell;
  const cellStyle = tableStyles.cell;
  const monoStyle = monospaceTextStyle({ fontSize: "0.8rem", opacity: 0.75 });

  return (
    <div style={wrapperStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headCellStyle}>Refund</th>
            <th style={headCellStyle}>Amount</th>
            <th style={headCellStyle}>Status</th>
            <th style={headCellStyle}>Reason</th>
            <th style={headCellStyle}>Requested</th>
            <th style={headCellStyle}>Processed</th>
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
                  <Link href={buildRefundLink(row.id, filters, page)}>{row.id}</Link>
                </div>
                {row.itineraryId ? (
                  <div style={monoStyle}>itinerary: {row.itineraryId}</div>
                ) : null}
                <div style={{ fontSize: "0.75rem", opacity: 0.6 }}>
                  {row.source === "fixtures" ? "fixture" : "live"}
                </div>
              </td>
              <td style={cellStyle}>{formatCurrency(row.amountCents, row.currency)}</td>
              <td style={cellStyle}>{renderStatus(row.status)}</td>
              <td style={cellStyle}>
                {row.reason ? (
                  <code style={monoStyle}>{truncate(row.reason, 96)}</code>
                ) : (
                  "—"
                )}
              </td>
              <td style={cellStyle}>{formatDateTime(row.requestedAt)}</td>
              <td style={cellStyle}>{formatDateTime(row.processedAt ?? undefined)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildRefundLink(id: string, filters: RefundFilters, page: number): string {
  const params = createFilterParams(filters);
  params.set("selected", id);
  params.set("page", String(page));
  return `/ops/refunds?${params.toString()}`;
}

function buildPageLink(filters: RefundFilters, page: number): string {
  const params = createFilterParams(filters);
  params.set("page", String(Math.max(1, page)));
  return `/ops/refunds?${params.toString()}`;
}

function createFilterParams(filters: RefundFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  return params;
}

function renderStatus(status?: string) {
  if (!status) return "—";
  const normalized = status.toLowerCase();
  const palette: Record<string, { bg: string; fg: string }> = {
    processing: { bg: "rgba(250, 204, 21, 0.25)", fg: "#fde68a" },
    succeeded: { bg: "rgba(34, 197, 94, 0.25)", fg: "#bbf7d0" },
    refunded: { bg: "rgba(59, 130, 246, 0.25)", fg: "#bfdbfe" },
    voided: { bg: "rgba(129, 140, 248, 0.25)", fg: "#c7d2fe" },
    failed: { bg: "rgba(239, 68, 68, 0.25)", fg: "#fecaca" },
  };

  const colors = palette[normalized] ?? {
    bg: "rgba(148, 163, 184, 0.25)",
    fg: "#cbd5f5",
  };

  return <span style={createBadgeStyle(colors)}>{status}</span>;
}

function formatCurrency(amountCents?: number, currency?: string) {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents) || amountCents <= 0) {
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
    }).format(amountCents / 100);
  } catch (_error) {
    return `${normalizedCurrency} ${(amountCents / 100).toFixed(2)}`;
  }
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

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function renderRefundDetail(rows: RefundRow[], selectedId: string) {
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
      <h3 style={{ marginTop: 0 }}>Refund detail</h3>
      <div>
        <div style={labelStyle}>Status</div>
        <div style={valueStyle}>{renderStatus(selected.status)}</div>
      </div>
      <div>
        <div style={labelStyle}>Amount</div>
        <div style={valueStyle}>{formatCurrency(selected.amountCents, selected.currency)}</div>
      </div>
      <div>
        <div style={labelStyle}>Itinerary</div>
        <div style={valueStyle}>{selected.itineraryId ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Reason</div>
        <div style={valueStyle}>{selected.reason ?? "—"}</div>
      </div>
      <div>
        <div style={labelStyle}>Requested</div>
        <div style={valueStyle}>{formatDateTime(selected.requestedAt)}</div>
      </div>
      <div>
        <div style={labelStyle}>Processed</div>
        <div style={valueStyle}>{formatDateTime(selected.processedAt ?? undefined)}</div>
      </div>
    </aside>
  );
}

function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null;
  const match = /\/(\d+)$/u.exec(header.trim());
  if (!match) return null;
  const total = Number(match[1]);
  if (!Number.isFinite(total) || total < 0) return null;
  return Math.floor(total);
}

async function RefundForm({ filters, page }: { filters: RefundFilters; page: number }) {
  const formStyle: CSSProperties = {
    display: "grid",
    gap: "0.75rem",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  };

  const fieldStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  };

  const inputStyle: CSSProperties = {
    padding: "0.45rem 0.65rem",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    background: "rgba(15, 23, 42, 0.25)",
    color: "inherit",
  };

  const buttonStyle: CSSProperties = {
    padding: "0.6rem 0.9rem",
    borderRadius: "6px",
    border: "1px solid rgba(148, 163, 184, 0.6)",
    background: "rgba(30, 64, 175, 0.65)",
    color: "#e2e8f0",
    cursor: "pointer",
    justifySelf: "flex-start",
  };

  return (
    <form action={createRefundAction} style={formStyle}>
      <input type="hidden" name="current_status" value={filters.status ?? ""} />
      <input type="hidden" name="current_page" value={String(Math.max(1, page))} />
      <label style={fieldStyle}>
        <span>Itinerary ID</span>
        <input
          type="text"
          name="itinerary_id"
          style={inputStyle}
          placeholder="UUID"
          required
          maxLength={64}
        />
      </label>
      <label style={fieldStyle}>
        <span>Amount (USD cents)</span>
        <input
          type="number"
          name="amount_cents"
          min={1}
          step={1}
          style={inputStyle}
          placeholder="15000"
          required
        />
      </label>
      <label style={fieldStyle}>
        <span>Currency</span>
        <input
          type="text"
          name="currency"
          style={inputStyle}
          defaultValue="USD"
          maxLength={3}
        />
      </label>
      <label style={fieldStyle}>
        <span>Reason</span>
        <textarea
          name="reason"
          style={{ ...inputStyle, minHeight: "96px", resize: "vertical" }}
          placeholder="Describe why the refund is issued"
          maxLength={200}
          required
        />
      </label>
      <button type="submit" style={buttonStyle}>
        Submit Refund
      </button>
    </form>
  );
}

async function createRefundAction(formData: FormData) {
  "use server";

  const itineraryId = String(formData.get("itinerary_id") ?? "").trim();
  const amountRaw = String(formData.get("amount_cents") ?? "").trim();
  const currencyRaw = String(formData.get("currency") ?? "USD").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const currentStatus = String(formData.get("current_status") ?? "").trim();
  const currentPageRaw = String(formData.get("current_page") ?? "").trim();

  const params = new URLSearchParams();
  if (currentStatus) {
    params.set("status", currentStatus);
  }
  const parsedPage = Number(currentPageRaw);
  if (Number.isFinite(parsedPage) && parsedPage >= 1) {
    params.set("page", String(Math.floor(parsedPage)));
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const errors: string[] = [];

  if (!uuidRegex.test(itineraryId)) {
    errors.push("itinerary_id must be a valid UUID");
  }

  const amountCents = Number(amountRaw);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    errors.push("amount_cents must be a positive number");
  }

  if (!reason || reason.length > 200) {
    errors.push("reason must be between 1 and 200 characters");
  }

  const currency = currencyRaw.toUpperCase() || "USD";

  if (errors.length > 0) {
    params.set("result", "error");
    params.set("message", encodeURIComponent(errors.join(", ")));
    redirect(`/ops/refunds?${params.toString()}`);
  }

  if (opsConsoleOfflineModeEnabled()) {
    revalidatePath("/ops/refunds");
    params.set("result", "simulated");
    redirect(`/ops/refunds?${params.toString()}`);
  }

  const configState = readSupabaseConfig();
  if (!configState.ok) {
    params.set("result", "error");
    params.set(
      "message",
      encodeURIComponent(`Missing Supabase env: ${configState.missing.join(", ")}`),
    );
    redirect(`/ops/refunds?${params.toString()}`);
  }

  const accessToken = cookies().get("sb-access-token")?.value;
  if (!accessToken) {
    params.set("result", "error");
    params.set(
      "message",
      encodeURIComponent("Supabase session cookie missing. Sign in again."),
    );
    redirect(`/ops/refunds?${params.toString()}`);
  }

  const payload = {
    itinerary_id: itineraryId,
    amount_cents: amountCents,
    reason,
    currency,
  };

  try {
    const response = await fetch(`${configState.config.url}/functions/v1/ops-refund`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: configState.config.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      params.set("result", "error");
      params.set(
        "message",
        encodeURIComponent(`ops-refund returned ${response.status}: ${text}`),
      );
      redirect(`/ops/refunds?${params.toString()}`);
    }

    const json = (await response.json()) as { request_id?: string } | null;
    const requestId = json && typeof json.request_id === "string"
      ? json.request_id
      : "submitted";

    revalidatePath("/ops/refunds");
    params.set("result", "success");
    params.set("request_id", requestId);
    redirect(`/ops/refunds?${params.toString()}`);
  } catch (error) {
    params.set("result", "error");
    params.set(
      "message",
      encodeURIComponent(`Failed contacting ops-refund: ${(error as Error).message}`),
    );
    redirect(`/ops/refunds?${params.toString()}`);
  }
}
