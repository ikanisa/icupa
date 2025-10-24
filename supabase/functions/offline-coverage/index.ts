// Edge function to surface offline coverage telemetry for admin dashboards.
import offlineFixture from "../../../ops/fixtures/offline_coverage.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "0") === "1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface CoverageRow {
  id?: string;
  region: string;
  country_code: string;
  availability_percent: number;
  offline_suppliers: number;
  sample_size: number;
  updated_at: string;
  incident_notes: string;
  health_label: string;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function filterRegion(rows: CoverageRow[], region: string | null) {
  if (!region) return rows;
  const normalized = region.trim().toLowerCase();
  return rows.filter((row) => row.region.toLowerCase().includes(normalized));
}

async function fetchCoverage(region: string | null): Promise<CoverageRow[]> {
  if (USE_FIXTURES) {
    const data = filterRegion(offlineFixture as CoverageRow[], region);
    return data;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Supabase configuration missing"), {
      code: ERROR_CODES.CONFIGURATION,
    });
  }
  const params = new URLSearchParams();
  params.set(
    "select",
    "region,country_code,availability_percent,offline_suppliers,sample_size,updated_at,incident_notes,health_label",
  );
  if (region) {
    const normalized = region.trim();
    if (normalized) {
      params.set("region", `ilike.*${normalized}*`);
    }
  }
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.v_offline_coverage?${params.toString()}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to fetch offline coverage: ${text}`), {
      code: ERROR_CODES.SUPPLIER_TIMEOUT,
    });
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as CoverageRow[]) : [];
}

function summarise(rows: CoverageRow[]) {
  const totalSample = rows.reduce((acc, row) => acc + row.sample_size, 0);
  const totalOffline = rows.reduce((acc, row) => acc + row.offline_suppliers, 0);
  const weightedAvailability = rows.reduce((acc, row) => acc + row.availability_percent * row.sample_size, 0);
  const weighted = totalSample > 0 ? Number((weightedAvailability / totalSample).toFixed(2)) : null;
  return {
    regions: rows.length,
    total_sample: totalSample,
    offline_suppliers: totalOffline,
    weighted_availability: weighted,
  };
}

Deno.serve(
  withObs(async (req) => {
    const requestId = getRequestId(req) ?? crypto.randomUUID();
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      const health = healthResponse("offline-coverage");
      const payload = await health.json();
      return json(payload);
    }

    if (req.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const regionParam = url.searchParams.get("region");
    if (regionParam && regionParam.length > 48) {
      return json({ ok: false, error: "region_too_long" }, { status: 400 });
    }

    const data = await fetchCoverage(regionParam);
    const summary = summarise(data);

    console.log(
      JSON.stringify({
        level: "AUDIT",
        fn: "offline-coverage",
        event: "offline.coverage.read",
        requestId,
        region: regionParam ?? "",
        records: data.length,
      }),
    );

    return json({ ok: true, data, summary, request_id: requestId });
  }, { fn: "offline-coverage", defaultErrorCode: ERROR_CODES.UNKNOWN }),
);
