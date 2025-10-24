import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "reservation-handle" });

type ReservationStatus = "pending" | "confirmed" | "cancelled" | "failed";

interface ReservationPayload {
  itinerary_id?: unknown;
  itineraryId?: unknown;
  item_id?: unknown;
  itemId?: unknown;
  supplier_ref?: unknown;
  supplierRef?: unknown;
  supplier_id?: unknown;
  supplierId?: unknown;
  confirmation_code?: unknown;
  confirmationCode?: unknown;
  status?: unknown;
  metadata?: unknown;
}

const ALLOWED_STATUS = new Set<ReservationStatus>([
  "pending",
  "confirmed",
  "cancelled",
  "failed",
]);

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("reservation-handle");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: ReservationPayload;
  try {
    payload = (await req.json()) as ReservationPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const itineraryId = normalizeUuid(payload.itinerary_id ?? payload.itineraryId);
  const itemId = normalizeUuid(payload.item_id ?? payload.itemId);
  const supplierRef = normalizeText(payload.supplier_ref ?? payload.supplierRef);
  const supplierId = normalizeUuid(payload.supplier_id ?? payload.supplierId);
  const confirmationCode = normalizeText(payload.confirmation_code ?? payload.confirmationCode);
  const status = normalizeStatus(payload.status);
  const metadata = normalizeMetadata(payload.metadata);

  if (!itineraryId) {
    return jsonResponse({ ok: false, error: "itinerary_id_required" }, 400);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ensure_reservation`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      itinerary_id: itineraryId,
      item_id: itemId,
      supplier_ref: supplierRef,
      supplier_id: supplierId,
      confirmation_code: confirmationCode,
      status,
      metadata,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("ensure_reservation_failed", {
      status: response.status,
      requestId,
      body: text,
    });
    return jsonResponse({ ok: false, error: "reservation_failed", request_id: requestId }, 502);
  }

  const reservationId = await response.json().catch(() => null) as unknown;
  const resolvedId = typeof reservationId === "string" ? reservationId : reservationId?.id ?? null;

  return jsonResponse({
    ok: true,
    request_id: requestId,
    reservation_id: resolvedId,
    status,
  });
}, { fn: "reservation-handle", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function normalizeUuid(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  return /^[0-9a-fA-F-]{36}$/.test(value) ? value : undefined;
}

function normalizeText(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  return value.length > 0 ? value : undefined;
}

function normalizeStatus(input: unknown): ReservationStatus {
  const value = typeof input === "string" ? input.trim().toLowerCase() : "pending";
  if (ALLOWED_STATUS.has(value as ReservationStatus)) {
    return value as ReservationStatus;
  }
  return "pending";
}

function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null) {
    return input as Record<string, unknown>;
  }
  return {};
}

function authorize(req: Request): boolean {
  const apiKey = req.headers.get("apikey") ?? req.headers.get("Apikey") ?? "";
  const bearer = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return apiKey === SERVICE_ROLE_KEY || bearer === `Bearer ${SERVICE_ROLE_KEY}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
