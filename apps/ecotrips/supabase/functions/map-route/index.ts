import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  buildWarnings,
  normalizeWarningOutputs,
  type WarningDetail,
} from "./warnings.ts";

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

interface RouteAdvisory {
  code: string;
  audience: "traveler" | "ops" | "safety";
  headline: string;
  detail: string;
  actions: string[];
  effective_from?: string;
  effective_to?: string;
  tags: string[];
}

interface RouteWarning {
  code: "night_travel" | "late_arrival_check_required" | "weather_alert";
  severity: "info" | "watch" | "alert";
  summary: string;
  detail: string;
  tags: string[];
  advisories: RouteAdvisory[];
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
    warning_details: RouteWarning[];
    advisories: RouteAdvisory[];
    legs: RouteLeg[];
    source: "stub";
  };
  request_id: string;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return mapRouteHealthResponse();
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

  const warningDetails = buildWarnings(departureTime, legTwoEnd);
  const warnings = warningDetails.map((warning) => warning.code);
  const advisories = warningDetails.flatMap((warning) => warning.advisories);

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
    warning_details: warningDetails,
    advisories,
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
      warning_details: warningDetails,
      advisories,
      legs,
      source: "stub",
    },
  };

  return jsonResponse(payload);
}, { fn: "map-route", defaultErrorCode: ERROR_CODES.UNKNOWN });

if (import.meta.main) {
  Deno.serve(handler);
}

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

function logSafetyWarningCoverage(details: {
  requestId: string;
  origin: string;
  destination: string;
  departureTime: Date;
  warnings: string[];
}) {
  const coverage = calculateSafetyWarningCoverage(details.warnings);
  const unknownWarnings = details.warnings.filter((warning) =>
    !SAFETY_WARNING_TYPES.includes(
      warning as (typeof SAFETY_WARNING_TYPES)[number],
    )
  );

  console.info(JSON.stringify({
    level: "INFO",
    event: "map.route.safety_warning.coverage",
    fn: "map-route",
    requestId: details.requestId,
    origin: details.origin,
    destination: details.destination,
    departure_time: details.departureTime.toISOString(),
    warnings: details.warnings,
    coverage,
    unknown_warnings: unknownWarnings,
  }));
}

function mapRouteHealthResponse(): Response {
  const body = buildMapRouteHealthPayload();
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: HEALTH_RESPONSE_HEADERS,
  });
}

function estimateDistanceMeters(origin: string, destination: string): number {
  const encoded = `${origin}|${destination}`.toLowerCase();
  let accumulator = 0;
  for (const char of encoded) {
    accumulator = (accumulator * 31 + char.charCodeAt(0)) % 1_000_000;
  }
  return 20_000 + accumulator;
}

function buildWarnings(start: Date, end: Date): RouteWarning[] {
  const warnings: RouteWarning[] = [];
  const departureHours = start.getUTCHours();
  const arrivalHours = end.getUTCHours();

  if (departureHours < 5 || departureHours >= 19) {
    const advisories: RouteAdvisory[] = [
      {
        code: "night_travel.traveler",
        audience: "traveler",
        headline: "Night driving expected",
        detail:
          "Departing outside daylight hours. Reduce speed, ensure headlights and spotlights are working, and share your ETA with concierge support.",
        actions: [
          "Inspect headlights before departure",
          "Share ETA with PlannerCoPilot",
        ],
        effective_from: start.toISOString(),
        effective_to: end.toISOString(),
        tags: ["night_travel", "visibility"],
      },
      {
        code: "night_travel.ops",
        audience: "ops",
        headline: "Monitor night transfer",
        detail:
          "Ops should schedule a check-in once the traveler arrives and keep emergency contacts handy in case of delays.",
        actions: ["Schedule arrival confirmation call"],
        effective_from: start.toISOString(),
        effective_to: end.toISOString(),
        tags: ["night_travel", "ops_followup"],
      },
    ];

    warnings.push({
      code: "night_travel",
      severity: "alert",
      summary: "Portions of this route occur at night",
      detail:
        "The planned departure happens before sunrise or after sunset. Expect limited visibility, wildlife crossings, and sparse roadside assistance.",
      tags: ["night", "visibility"],
      advisories,
    });
  }

  if (arrivalHours >= 21 || arrivalHours < 6) {
    const advisories: RouteAdvisory[] = [
      {
        code: "late_arrival.traveler",
        audience: "traveler",
        headline: "Late check-in required",
        detail:
          "Arrival is projected after 21:00. Coordinate with lodging or supplier for late access and keep emergency contacts nearby.",
        actions: ["Notify lodging of late check-in", "Keep emergency contacts handy"],
        effective_from: start.toISOString(),
        effective_to: end.toISOString(),
        tags: ["late_arrival", "supplier"],
      },
      {
        code: "late_arrival.ops",
        audience: "ops",
        headline: "Ops follow-up recommended",
        detail:
          "Late arrival triggers an ops confirmation. Verify supplier check-in procedures and be ready for escalation if the traveler cannot reach staff.",
        actions: ["Confirm supplier contact availability"],
        effective_from: start.toISOString(),
        effective_to: end.toISOString(),
        tags: ["late_arrival", "ops_followup"],
      },
    ];

    warnings.push({
      code: "late_arrival_check_required",
      severity: "watch",
      summary: "Arrival occurs after standard check-in hours",
      detail:
        "Expect to reach the destination after 21:00. Coordinate supplier late check-in steps and escalate to ops if contact fails.",
      tags: ["late_arrival", "check_in"],
      advisories,
    });
  }

  return warnings;
}
