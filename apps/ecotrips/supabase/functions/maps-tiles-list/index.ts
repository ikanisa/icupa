import packsFixture from "../../../ops/fixtures/maps_tiles_packs.json" with { type: "json" };

import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface TilePackFixture {
  id?: string;
  slug?: string;
  region?: string;
  title?: string;
  description?: string;
  updated_at?: string;
  tiles?: number;
  bundle_bytes?: number;
  offline_zip_bytes?: number;
  storage_path?: string;
  manifest_path?: string;
  preview_url?: string;
  checksum_sha256?: string;
  languages?: string[];
  coverage?: {
    center?: { lat?: number; lng?: number };
    radius_km?: number;
    bounding_box?: { north?: number; south?: number; east?: number; west?: number };
  };
  offline_layers?: Array<{ id?: string; kind?: string; size_bytes?: number }>;
  notes?: string;
  recommended_app_version?: string;
}

const TILE_PACKS: TilePackFixture[] = Array.isArray(packsFixture)
  ? packsFixture as TilePackFixture[]
  : [];

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("maps-tiles-list");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, 405);
  }

  const region = normalizeString(url.searchParams.get("region"));
  const includeExperimental = url.searchParams.get("include_experimental") === "1";

  const packs = TILE_PACKS
    .filter((pack) => filterRegion(pack, region))
    .filter((pack) => includeExperimental ? true : !isExperimental(pack))
    .map((pack) => normalizePack(pack));

  return jsonResponse({
    ok: true,
    request_id: requestId,
    source: "fixtures",
    generated_at: new Date().toISOString(),
    packs,
  });
}, { fn: "maps-tiles-list", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeString(value: string | null): string {
  return value ? value.trim().toLowerCase() : "";
}

function filterRegion(pack: TilePackFixture, region: string): boolean {
  if (!region) return true;
  return normalizeString(pack.region ?? "") === region;
}

function isExperimental(pack: TilePackFixture): boolean {
  const notes = normalizeString(pack.notes ?? "");
  return notes.includes("experimental") || notes.includes("beta");
}

function normalizePack(pack: TilePackFixture) {
  return {
    id: pack.id ?? crypto.randomUUID(),
    slug: pack.slug ?? "unknown-pack",
    region: pack.region ?? "unknown",
    title: pack.title ?? pack.slug ?? "Offline tile pack",
    description: pack.description ?? "Offline tiles available for download.",
    updated_at: pack.updated_at ?? new Date().toISOString(),
    tiles: pack.tiles ?? 0,
    bundle_bytes: pack.bundle_bytes ?? 0,
    offline_zip_bytes: pack.offline_zip_bytes ?? pack.bundle_bytes ?? 0,
    storage_path: pack.storage_path ?? "",
    manifest_path: pack.manifest_path ?? null,
    preview_url: pack.preview_url ?? null,
    checksum_sha256: pack.checksum_sha256 ?? null,
    languages: Array.isArray(pack.languages) ? pack.languages : [],
    coverage: {
      center: {
        lat: pack.coverage?.center?.lat ?? 0,
        lng: pack.coverage?.center?.lng ?? 0,
      },
      radius_km: pack.coverage?.radius_km ?? 0,
      bounding_box: {
        north: pack.coverage?.bounding_box?.north ?? 0,
        south: pack.coverage?.bounding_box?.south ?? 0,
        east: pack.coverage?.bounding_box?.east ?? 0,
        west: pack.coverage?.bounding_box?.west ?? 0,
      },
    },
    offline_layers: Array.isArray(pack.offline_layers)
      ? pack.offline_layers.map((layer) => ({
        id: layer.id ?? crypto.randomUUID(),
        kind: layer.kind ?? "layer",
        size_bytes: layer.size_bytes ?? 0,
      }))
      : [],
    notes: pack.notes ?? null,
    recommended_app_version: pack.recommended_app_version ?? null,
  };
}
