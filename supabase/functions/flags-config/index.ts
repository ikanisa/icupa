import { ERROR_CODES } from "../_obs/constants.ts";
import { emitMetric, getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

import fixtureFlags from "../../../ops/fixtures/flags_config.json" assert { type: "json" };

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "flags-config" });

interface FixtureFlag {
  key: string;
  description?: string;
  variants?: Array<{ name: string; exposure: number; conversions: number; uplift?: number }>;
}

const fixtureList = Array.isArray(fixtureFlags) ? fixtureFlags as FixtureFlag[] : [];

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("flags-config");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const liveFlags = await loadLiveFlags();

  const merged = fixtureList.map((flag) => {
    const live = liveFlags.get(flag.key);
    return {
      key: flag.key,
      description: live?.description ?? flag.description ?? "",
      enabled: live?.enabled ?? false,
      variants: flag.variants ?? [],
    };
  });

  let analyticsForwarded = 0;
  for (const flag of merged) {
    for (const variant of flag.variants) {
      analyticsForwarded += 1;
      emitMetric({
        fn: "flags-config",
        requestId,
        name: `flag.${flag.key}.${variant.name}.exposure`,
        value: Math.round(variant.exposure * 100),
        unit: "percent",
        tags: { flag: flag.key, variant: variant.name },
      });
      console.log(JSON.stringify({
        level: "INFO",
        event: "flags.variant.analytics",
        fn: "flags-config",
        requestId,
        flag: flag.key,
        variant: variant.name,
        exposure: variant.exposure,
        conversions: variant.conversions,
        uplift: variant.uplift ?? 0,
      }));
    }
  }

  return jsonResponse({
    ok: true,
    request_id: requestId,
    flags: merged,
    analytics_forwarded: analyticsForwarded,
  });
}, { fn: "flags-config", defaultErrorCode: ERROR_CODES.INPUT_INVALID });

async function loadLiveFlags(): Promise<Map<string, { enabled: boolean; description?: string }>> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/ops.console_feature_flags?select=key,description,enabled`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!response.ok) {
      return new Map();
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return new Map();
    }
    const map = new Map<string, { enabled: boolean; description?: string }>();
    for (const row of rows) {
      if (typeof row?.key === "string") {
        map.set(row.key, {
          enabled: Boolean(row.enabled),
          description: typeof row.description === "string" ? row.description : undefined,
        });
      }
    }
    return map;
  } catch (_error) {
    return new Map();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default handler;
