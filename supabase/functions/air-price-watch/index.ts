import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("air-price-watch");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const origin = parseAirport(body.origin);
  const destination = parseAirport(body.destination);
  const departureDate = parseDate(body.departure_date);
  const returnDate = body.return_date ? parseDate(body.return_date) : null;
  const seats = Number(body.seats ?? 0);
  const cabin = typeof body.cabin === "string" ? body.cabin.toLowerCase() : "";
  const targetPriceCents = body.target_price_cents ? Number(body.target_price_cents) : null;
  const travelerName = typeof body.traveler_name === "string" ? body.traveler_name.trim() : "";
  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim() : "";
  const itineraryId = typeof body.itinerary_id === "string" ? body.itinerary_id : null;

  const errors: string[] = [];
  if (!origin) errors.push("origin must be a valid IATA code");
  if (!destination) errors.push("destination must be a valid IATA code");
  if (!departureDate) errors.push("departure_date must be YYYY-MM-DD");
  if (returnDate === false) errors.push("return_date must be YYYY-MM-DD");
  if (!Number.isInteger(seats) || seats <= 0 || seats > 9) {
    errors.push("seats must be between 1 and 9");
  }
  if (!isSupportedCabin(cabin)) {
    errors.push("cabin must be economy, premium_economy, or business");
  }
  if (!travelerName) errors.push("traveler_name is required");
  if (!isValidEmail(contactEmail)) errors.push("contact_email must be valid");
  if (targetPriceCents !== null && (!Number.isInteger(targetPriceCents) || targetPriceCents <= 0)) {
    errors.push("target_price_cents must be a positive integer when provided");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const watchId = `watch-${crypto.randomUUID()}`;
  const submittedAt = new Date().toISOString();

  logAudit({
    request_id: requestId,
    watch_id: watchId,
    origin,
    destination,
    departure_date: departureDate,
    return_date: returnDate,
    seats,
    cabin,
    has_target_price: targetPriceCents !== null,
    itinerary_id: itineraryId,
  });

  return jsonResponse({
    ok: true,
    watch_id: watchId,
    request_id: requestId,
    submitted_at: submittedAt,
  });
}, { fn: "air-price-watch", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseAirport(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
}

function parseDate(value: unknown): string | false {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? false : trimmed;
}

function isSupportedCabin(value: string): boolean {
  return value === "economy" || value === "premium_economy" || value === "business";
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "air.price.watch",
      fn: "air-price-watch",
      ...fields,
    }),
  );
}
