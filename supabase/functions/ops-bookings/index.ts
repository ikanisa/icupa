// AUDIT: This mock function emits structured audit logs for offline analysis.
import bookingsFixture from "../../../ops/fixtures/bookings.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type BookingFixture = {
  id: string;
  itinerary_id: string;
  supplier: string;
  start_date: string;
  end_date: string;
  traveler: string;
  status: string;
};

type BookingViewRow = {
  id: string;
  created_at: string;
  status: string;
  total_cents: number;
  currency: string;
  has_items: boolean;
  primary_supplier: string | null;
};

const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "1") !== "0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const bookings = (bookingsFixture as BookingFixture[]).map((item) => ({
  ...item,
}));

function auditLog(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "ops.bookings",
      fn: "ops-bookings",
      ...fields,
    }),
  );
}

function toJson(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function filterFixtures(
  from: Date | null,
  to: Date | null,
  supplierParam: string | null,
) {
  return bookings.filter((booking) => {
    const start = new Date(booking.start_date);
    if (Number.isNaN(start.getTime())) {
      return false;
    }

    if (from && start < from) {
      return false;
    }
    if (to && start > to) {
      return false;
    }
    if (supplierParam && booking.supplier.toLowerCase() !== supplierParam) {
      return false;
    }
    return true;
  });
}

async function fetchViewData(
  from: Date | null,
  to: Date | null,
  supplierParam: string | null,
): Promise<BookingViewRow[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing for live view");
  }

  const params = new URLSearchParams();
  params.set(
    "select",
    "id,created_at,status,total_cents,currency,has_items,primary_supplier",
  );

  if (from) {
    const fromStr = from.toISOString().slice(0, 10);
    params.append("created_at", `gte.${fromStr}`);
  }
  if (to) {
    const toStr = to.toISOString().slice(0, 10);
    params.append("created_at", `lte.${toStr}`);
  }
  if (supplierParam) {
    params.append("primary_supplier", `ilike.%${supplierParam}%`);
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.v_bookings?${params.toString()}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to fetch ops.v_bookings: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const data = (await response.json()) as BookingViewRow[];
  return Array.isArray(data) ? data : [];
}

Deno.serve(withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("ops-bookings");
  }

  if (req.method !== "GET") {
    return toJson({ ok: false, error: "GET only" }, { status: 405 });
  }
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const supplierRaw = url.searchParams.get("supplier");
  const supplierParam = supplierRaw?.trim().toLowerCase() || null;

  if (supplierRaw && supplierRaw.length > 64) {
    return toJson({ ok: false, error: "supplier must be <= 64 characters" }, {
      status: 400,
    });
  }

  if (url.searchParams.has("from") && !from) {
    return toJson({ ok: false, error: "Invalid from date" }, { status: 400 });
  }
  if (url.searchParams.has("to") && !to) {
    return toJson({ ok: false, error: "Invalid to date" }, { status: 400 });
  }

  try {
    if (USE_FIXTURES) {
      const filtered = filterFixtures(from, to, supplierParam);
      auditLog({
        requestId,
        source: "fixtures",
        from: from ? from.toISOString().slice(0, 10) : "",
        to: to ? to.toISOString().slice(0, 10) : "",
        supplier: supplierParam ?? "",
        results: filtered.length,
      });
      return toJson({ ok: true, data: filtered, request_id: requestId });
    }

    const rows = await fetchViewData(from, to, supplierParam);
    auditLog({
      requestId,
      source: "view",
      from: from ? from.toISOString().slice(0, 10) : "",
      to: to ? to.toISOString().slice(0, 10) : "",
      supplier: supplierParam ?? "",
      results: rows.length,
    });
    return toJson({ ok: true, data: rows, request_id: requestId });
  } catch (error) {
    auditLog({
      requestId,
      source: USE_FIXTURES ? "fixtures" : "view",
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "ops-bookings", defaultErrorCode: ERROR_CODES.UNKNOWN }));
