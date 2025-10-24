import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { fetchSupplierTrustBadges, resolveSupplierAuth } from "../_shared/suppliers.ts";

import fixtureOrders from "../../../ops/fixtures/supplier_orders.json" assert { type: "json" };

interface FixtureOrder {
  id: string;
  supplier_slug: string;
  itinerary: string;
  start_date: string;
  travelers: number;
  status: string;
  total_cents: number;
  currency: string;
  notes?: string;
  badge_codes?: string[];
}

interface SupplierOrderPayload {
  id: string;
  itinerary: string;
  start_date: string;
  travelers: number;
  status: string;
  total_cents: number;
  currency: string;
  notes?: string;
  badges?: Array<{ code: string; label: string; description?: string | null }>;
}

const orders = Array.isArray(fixtureOrders) ? fixtureOrders as FixtureOrder[] : [];

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("supplier-orders");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const auth = await resolveSupplierAuth(req);
  if (!auth.valid || !auth.supplierSlug) {
    return jsonResponse({ ok: false, error: "unauthorized", request_id: requestId }, 401);
  }

  const supplierSlug = auth.supplierSlug;
  const includeBadgesRaw = url.searchParams.get("include_badges");
  const includeBadges = includeBadgesRaw === "true" || includeBadgesRaw === "1";

  let badges: Awaited<ReturnType<typeof fetchSupplierTrustBadges>> = [];
  if (includeBadges) {
    badges = await fetchSupplierTrustBadges(supplierSlug).catch(() => []);
  }

  const badgeMap = new Map<string, { code: string; label: string; description?: string | null }>();
  for (const badge of badges) {
    badgeMap.set(badge.code, {
      code: badge.code,
      label: badge.label,
      description: badge.description,
    });
  }

  const filtered = orders.filter((order) => order.supplier_slug === supplierSlug);
  const payload: SupplierOrderPayload[] = filtered.map((order) => ({
    id: order.id,
    itinerary: order.itinerary,
    start_date: order.start_date,
    travelers: order.travelers,
    status: order.status,
    total_cents: order.total_cents,
    currency: order.currency,
    notes: order.notes,
    badges: includeBadges
      ? (order.badge_codes ?? []).map((code) =>
        badgeMap.get(code) ?? {
          code,
          label: toBadgeLabel(code),
          description: null,
        }
      )
      : undefined,
  }));

  console.log(JSON.stringify({
    level: "INFO",
    event: "supplier.orders.listed",
    fn: "supplier-orders",
    requestId,
    supplier: supplierSlug,
    orders: payload.length,
    includeBadges,
  }));

  return jsonResponse({
    ok: true,
    supplier: supplierSlug,
    orders: payload,
    request_id: requestId,
    badges_included: includeBadges,
  });
}, { fn: "supplier-orders", defaultErrorCode: ERROR_CODES.INPUT_INVALID });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toBadgeLabel(code: string): string {
  return code
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default handler;
