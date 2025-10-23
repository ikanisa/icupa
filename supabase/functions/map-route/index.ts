import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { buildWarnings as computeWarnings } from "./warnings.ts";

interface RouteRequestBody {
  origin?: string;
  destination?: string;
  departure_time?: string;
}

interface RouteLeg {
  leg_id: string;
  summary: string;
  mode: "drive" | "walk" | "idle";
  distance_meters: number;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  notes?: string;
}

interface RoutePayload {
  ok: true;
  route: {
    origin: string;
    destination: string;
    departure_time: string;
    arrival_time: string;
    total_minutes: number;
    distance_meters: number;
    warnings: string[];
    legs: RouteLeg[];
    source: "stub";
  };
  request_id: string;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("map-route");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: RouteRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const origin = typeof body.origin === "string" ? body.origin.trim() : "";
  const destination =
    typeof body.destination === "string" ? body.destination.trim() : "";
  const departureRaw =
    typeof body.departure_time === "string" ? body.departure_time : null;

  const errors: string[] = [];
  if (!origin) errors.push("origin is required");
  if (!destination) errors.push("destination is required");

  let departureTime = new Date();
  if (departureRaw) {
    const parsed = new Date(departureRaw);
    if (Number.isNaN(parsed.getTime())) {
      errors.push("departure_time must be an ISO 8601 string");
    } else {
      departureTime = parsed;
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const distanceMeters = Math.max(
    5_000,
    Math.round(estimateDistanceMeters(origin, destination)),
  );
  const totalMinutes = Math.max(45, Math.round(distanceMeters / 700));

  const legOneMinutes = Math.round(totalMinutes * 0.6);
  const legTwoMinutes = Math.max(15, totalMinutes - legOneMinutes);

  const legOneEnd = new Date(departureTime.getTime() + legOneMinutes * 60_000);
  const legTwoEnd = new Date(legOneEnd.getTime() + legTwoMinutes * 60_000);

  const warnings = buildWarnings(departureTime, legTwoEnd);

  const legs: RouteLeg[] = [
    {
      leg_id: "leg-1",
      summary: `Depart ${origin} toward checkpoint`,
      mode: "drive",
      distance_meters: Math.round(distanceMeters * 0.6),
      duration_minutes: legOneMinutes,
      start_time: departureTime.toISOString(),
      end_time: legOneEnd.toISOString(),
      notes: "Monitor road conditions around wetlands and reduce speed when wet.",
    },
    {
      leg_id: "leg-2",
      summary: `Continue to ${destination}`,
      mode: "drive",
      distance_meters: distanceMeters - Math.round(distanceMeters * 0.6),
      duration_minutes: legTwoMinutes,
      start_time: legOneEnd.toISOString(),
      end_time: legTwoEnd.toISOString(),
      notes: warnings.includes("night_travel")
        ? "Night travel expected — confirm headlights and security checks."
        : "Arrive and confirm supplier check-in window.",
    },
  ];

  logAudit({
    requestId,
    origin,
    destination,
    distance_meters: distanceMeters,
    total_minutes: totalMinutes,
    warnings,
  });

  const payload: RoutePayload = {
    ok: true,
    request_id: requestId,
    route: {
      origin,
      destination,
      departure_time: departureTime.toISOString(),
      arrival_time: legTwoEnd.toISOString(),
      total_minutes: totalMinutes,
      distance_meters: distanceMeters,
      warnings,
      legs,
      source: "stub",
    },
  };

  return jsonResponse(payload);
}, { fn: "map-route", defaultErrorCode: ERROR_CODES.UNKNOWN });

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
    event: "map.route.stub",
    fn: "map-route",
    ...fields,
  }));
}

function estimateDistanceMeters(origin: string, destination: string): number {
  const encoded = `${origin}|${destination}`.toLowerCase();
  let accumulator = 0;
  for (const char of encoded) {
    accumulator = (accumulator * 31 + char.charCodeAt(0)) % 1_000_000;
  }
  return 20_000 + accumulator;
}

function buildWarnings(start: Date, end: Date): string[] {
  return computeWarnings(start, end);
}
