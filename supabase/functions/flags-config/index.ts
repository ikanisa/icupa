// Edge function to expose feature flags for client/admin apps.
import flagsFixture from "../../../ops/fixtures/flags-config.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const FEATURE_KEYS = [
  "client.explain_price.glass",
  "client.autonomy_dial",
  "client.suggestion_chips.top",
] as const;

const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "0") === "1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface FlagRecord {
  key: string;
  enabled: boolean;
  updated_at: string;
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

async function fetchFlags(): Promise<{ features: Record<string, boolean>; updated_at: string }> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Supabase configuration missing"), {
      code: ERROR_CODES.CONFIGURATION,
    });
  }
  const params = new URLSearchParams();
  params.set("select", "key,enabled,updated_at");
  const keys = FEATURE_KEYS.map((key) => `"${key.replace(/"/g, '""')}"`).join(",");
  params.set("key", `in.(${keys})`);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.console_feature_flags?${params.toString()}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to fetch console feature flags: ${text}`), {
      code: ERROR_CODES.SUPPLIER_TIMEOUT,
    });
  }
  const rows = (await response.json()) as unknown;
  if (!Array.isArray(rows)) {
    return { features: {}, updated_at: new Date().toISOString() };
  }
  const featureMap = new Map<string, FlagRecord>();
  for (const row of rows as FlagRecord[]) {
    featureMap.set(row.key, row);
  }
  const features: Record<string, boolean> = {};
  let latest = 0;
  FEATURE_KEYS.forEach((key) => {
    const record = featureMap.get(key);
    if (record) {
      features[key] = record.enabled;
      const ts = Date.parse(record.updated_at);
      if (Number.isFinite(ts)) {
        latest = Math.max(latest, ts);
      }
    } else {
      features[key] = false;
    }
  });
  return {
    features,
    updated_at: latest ? new Date(latest).toISOString() : new Date().toISOString(),
  };
}

Deno.serve(
  withObs(async (req) => {
    const requestId = getRequestId(req) ?? crypto.randomUUID();
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return healthResponse("flags-config");
    }

    if (req.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    if (USE_FIXTURES) {
      console.log(
        JSON.stringify({
          level: "AUDIT",
          event: "flags.config.fixture",
          fn: "flags-config",
          requestId,
        }),
      );
      return json({
        ok: true,
        request_id: requestId,
        updated_at: (flagsFixture as { updated_at: string }).updated_at,
        features: (flagsFixture as { features: Record<string, boolean> }).features,
        fixture: {
          path: "ops/fixtures/flags-config.json",
          notes: (flagsFixture as { notes?: string }).notes ?? "",
        },
      });
    }

    const data = await fetchFlags();
    console.log(
      JSON.stringify({
        level: "AUDIT",
        event: "flags.config.view",
        fn: "flags-config",
        requestId,
        updated_at: data.updated_at,
      }),
    );
    return json({
      ok: true,
      request_id: requestId,
      updated_at: data.updated_at,
      features: data.features,
      fixture: {
        path: "ops/fixtures/flags-config.json",
      },
    });
  }, { fn: "flags-config", defaultErrorCode: ERROR_CODES.UNKNOWN }),
);
