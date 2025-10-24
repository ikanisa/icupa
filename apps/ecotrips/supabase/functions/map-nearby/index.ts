import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type NearbyRequestBody = {
  location?: { lat?: number; lng?: number } | null;
  category?: string;
  radius_meters?: number;
};

type NearbyResult = {
  id: string;
  name: string;
  category: string;
  distance_meters: number;
  coordinates: { lat: number; lng: number };
  open_hours: string;
  safety_rating: "green" | "amber" | "red";
  notes?: string;
  caution?: string;
};

const DEFAULT_POINTS: NearbyResult[] = [
  {
    id: "poi-umuganda-market",
    name: "Umuganda Market",
    category: "dining",
    distance_meters: 0,
    coordinates: { lat: -1.9553, lng: 30.0891 },
    open_hours: "07:00-19:00",
    safety_rating: "green",
    notes: "Fresh produce and snacks; mobile money accepted.",
  },
  {
    id: "poi-kimihurura-garden",
    name: "Kimihurura Garden Walk",
    category: "nature",
    distance_meters: 0,
    coordinates: { lat: -1.9521, lng: 30.0852 },
    open_hours: "06:00-18:00",
    safety_rating: "green",
    notes: "Shaded walking trail — avoid after dark due to low lighting.",
  },
  {
    id: "poi-camp-kigali",
    name: "Camp Kigali Memorial",
    category: "history",
    distance_meters: 0,
    coordinates: { lat: -1.9512, lng: 30.0613 },
    open_hours: "08:00-17:00",
    safety_rating: "green",
    notes: "Guided tours available; pre-book during high season.",
  },
  {
    id: "poi-nyamirambo-night",
    name: "Nyamirambo Night Food Crawl",
    category: "dining",
    distance_meters: 0,
    coordinates: { lat: -1.9576, lng: 30.0528 },
    open_hours: "17:00-23:00",
    safety_rating: "amber",
    notes: "Recommend accompanied guide after 21:00; cash preferred.",
  },
];

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("map-nearby");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: NearbyRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const category = typeof body.category === "string"
    ? body.category.trim().toLowerCase()
    : "";

  const radius = normalizeRadius(body.radius_meters);

  const { lat, lng } = normalizeCoordinates(body.location);

  const errors: string[] = [];
  if (!category) errors.push("category is required");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    errors.push("location.lat and location.lng are required");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const results = DEFAULT_POINTS
    .filter((point) => point.category === category)
    .map((point) => {
      const distance = haversineMeters(lat, lng, point.coordinates.lat, point.coordinates.lng);
      return {
        ...point,
        distance_meters: Math.round(distance),
        caution: point.safety_rating === "amber"
          ? "advise buddy system after dark"
          : undefined,
      };
    })
    .filter((point) => point.distance_meters <= radius)
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, 6);

  logAudit({
    requestId,
    category,
    radius,
    origin_lat: lat,
    origin_lng: lng,
    result_count: results.length,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    results,
    source: "stub",
  });
}, { fn: "map-nearby", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logAudit(fields: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "AUDIT",
    event: "map.nearby.stub",
    fn: "map-nearby",
    ...fields,
  }));
}

function normalizeRadius(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 2_000;
  return Math.min(20_000, Math.max(200, Math.round(parsed)));
}

function normalizeCoordinates(location: NearbyRequestBody["location"]): {
  lat: number;
  lng: number;
} {
  const lat = typeof location?.lat === "number" ? location.lat : Number.NaN;
  const lng = typeof location?.lng === "number" ? location.lng : Number.NaN;
  return { lat, lng };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
