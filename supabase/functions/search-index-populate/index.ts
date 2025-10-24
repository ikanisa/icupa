import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";
import { searchIndexFixtures } from "../../shared/catalogFixtures.ts";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("search-index-populate");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, 405);
  }

  let config: { url: string; serviceRoleKey: string } | null = null;
  try {
    config = getSupabaseServiceConfig({ feature: "catalog" });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "catalog.search_index.config_missing",
        fn: "search-index-populate",
        requestId,
        message: (error as Error).message,
      }),
    );
  }

  if (!config) {
    return jsonResponse(
      {
        ok: false,
        error: "supabase_config_missing",
        requestId,
        fallback: true,
        seeded: 0,
        fixtures: searchIndexFixtures,
      },
      503,
    );
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (authHeader !== `Bearer ${config.serviceRoleKey}`) {
    const error = new Error("service role authorization required");
    (error as { code?: string }).code = ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  const rows = searchIndexFixtures.map((entry) => ({
    slug: entry.slug,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    title: entry.title,
    subtitle: entry.subtitle ?? null,
    keywords: entry.keywords,
    metadata: entry.metadata,
  }));

  try {
    const response = await fetch(`${config.url}/rest/v1/catalog.search_index`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        "Accept-Profile": "catalog",
        "Content-Profile": "catalog",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        JSON.stringify({
          level: "ERROR",
          event: "catalog.search_index.seed_failed",
          fn: "search-index-populate",
          requestId,
          status: response.status,
          body: text,
        }),
      );
      return jsonResponse(
        {
          ok: false,
          error: "seed_failed",
          requestId,
          fallback: true,
          seeded: 0,
          details: text,
        },
        502,
      );
    }

    let inserted: unknown = null;
    try {
      inserted = await response.json();
    } catch (_error) {
      inserted = null;
    }

    const count = Array.isArray(inserted) ? inserted.length : rows.length;

    console.log(
      JSON.stringify({
        level: "AUDIT",
        event: "catalog.search_index.seeded",
        fn: "search-index-populate",
        requestId,
        seeded: count,
        source: "fixtures",
      }),
    );

    return jsonResponse({
      ok: true,
      requestId,
      seeded: count,
      source: "fixtures",
      fallback: false,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "catalog.search_index.seed_error",
        fn: "search-index-populate",
        requestId,
        message: (error as Error).message,
      }),
    );
    return jsonResponse(
      {
        ok: false,
        error: "seed_exception",
        requestId,
        fallback: true,
        seeded: 0,
        details: (error as Error).message,
      },
      500,
    );
  }
}, { fn: "search-index-populate", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
