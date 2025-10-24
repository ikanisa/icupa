import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { assertAuthenticated, resolveUserContext } from "../_shared/auth.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "pricing" });

const PRICING_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "pricing",
  "Content-Profile": "pricing",
} as const;

const APPLICATION_HEADERS = {
  ...PRICING_HEADERS,
  Prefer: "return=representation",
} as const;

interface PricingRuleRow {
  id: string;
  code: string;
  kind: string;
  value: number;
  currency: string | null;
  max_redemptions: number | null;
  per_user_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface PricingApplicationRow {
  id: string;
  rule_id: string | null;
  promo_code: string;
  discount_cents: number;
  currency: string;
  breakdown: Record<string, unknown> | null;
  request_key: string | null;
}

interface PricingRequest {
  itineraryId: string;
  promoCode: string;
  baseTotalCents: number;
  currency: string;
  lineItems: Array<{
    id: string;
    label: string;
    quantity: number;
    amount_cents: number;
  }>;
  requestKey?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("pricing-apply");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const user = await resolveUserContext(req);
  assertAuthenticated(user);

  let raw: Record<string, unknown>;
  try {
    raw = await req.json() as Record<string, unknown>;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const parsed = parsePricingRequest(raw);
  const derivedKey = parsed.requestKey ?? await deriveRequestKey([
    user.profileId,
    parsed.promoCode,
    parsed.itineraryId,
    String(parsed.baseTotalCents),
  ]);

  const existing = await fetchExistingApplication(derivedKey);
  if (existing) {
    logEvent({
      requestId,
      profileId: user.profileId,
      promoCode: existing.promo_code,
      ruleId: existing.rule_id,
      reused: true,
    });
    const discount = Math.max(0, existing.discount_cents ?? 0);
    return jsonResponse({
      ok: true,
      promo_code: existing.promo_code,
      rule_id: existing.rule_id ?? undefined,
      discount_cents: discount,
      total_after_cents: Math.max(0, parsed.baseTotalCents - discount),
      currency: existing.currency ?? parsed.currency,
      adjustments: Array.isArray(existing.breakdown?.adjustments)
        ? existing.breakdown?.adjustments
        : [],
      loyalty_points: typeof existing.breakdown?.loyalty_points === "number"
        ? existing.breakdown?.loyalty_points
        : undefined,
      message: existing.breakdown?.message as string | undefined,
      request_id: derivedKey,
    });
  }

  const rule = await fetchActiveRule(parsed.promoCode);
  if (!rule) {
    const error = new Error("Promo code inactive or missing");
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  await enforceRedemptionLimits({
    profileId: user.profileId,
    rule,
  });

  const discount = calculateDiscount({
    rule,
    baseTotalCents: parsed.baseTotalCents,
    currency: parsed.currency,
  });
  const totalAfter = Math.max(0, parsed.baseTotalCents - discount.discountCents);
  const loyaltyPoints = Math.max(0, Math.round(totalAfter / 100));

  const breakdown = {
    adjustments: [
      {
        label: `${parsed.promoCode} promo`,
        amount_cents: -discount.discountCents,
        type: "promo",
      },
    ],
    loyalty_points: loyaltyPoints,
    message: discount.message,
    line_items: parsed.lineItems,
  } satisfies Record<string, unknown>;

  const inserted = await insertApplication({
    profileId: user.profileId,
    itineraryId: parsed.itineraryId,
    ruleId: rule.id,
    promoCode: parsed.promoCode,
    baseTotalCents: parsed.baseTotalCents,
    discountCents: discount.discountCents,
    currency: parsed.currency,
    breakdown,
    requestKey: derivedKey,
  });

  logEvent({
    requestId,
    profileId: user.profileId,
    promoCode: parsed.promoCode,
    ruleId: rule.id,
    reused: false,
  });

  return jsonResponse({
    ok: true,
    promo_code: parsed.promoCode,
    rule_id: rule.id,
    discount_cents: discount.discountCents,
    total_after_cents: totalAfter,
    currency: parsed.currency,
    adjustments: breakdown.adjustments,
    loyalty_points: loyaltyPoints,
    message: discount.message,
    request_id: inserted.request_key ?? derivedKey,
  });
}, { fn: "pricing-apply", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function parsePricingRequest(body: Record<string, unknown>): PricingRequest {
  const errors: string[] = [];
  const itineraryId = typeof body.itinerary_id === "string" ? body.itinerary_id.trim() : "";
  const promoCode = typeof body.promo_code === "string" ? body.promo_code.trim().toUpperCase() : "";
  const baseTotalCents = Number(body.base_total_cents);
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const requestKey = typeof body.request_key === "string" ? body.request_key.trim() : undefined;

  if (!UUID_REGEX.test(itineraryId)) {
    errors.push("itinerary_id must be a UUID");
  }
  if (!promoCode || promoCode.length < 3 || promoCode.length > 64) {
    errors.push("promo_code must be 3-64 characters");
  }
  if (!Number.isInteger(baseTotalCents) || baseTotalCents < 0) {
    errors.push("base_total_cents must be a non-negative integer");
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.push("currency must be a 3-letter ISO code");
  }
  if (requestKey && (requestKey.length < 6 || requestKey.length > 128)) {
    errors.push("request_key must be 6-128 characters when provided");
  }

  const rawItems = Array.isArray(body.line_items) ? body.line_items : [];
  const lineItems = rawItems
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const id = typeof (entry as Record<string, unknown>).id === "string"
        ? (entry as Record<string, unknown>).id.trim()
        : "";
      const label = typeof (entry as Record<string, unknown>).label === "string"
        ? (entry as Record<string, unknown>).label.trim()
        : "";
      const quantity = Number((entry as Record<string, unknown>).quantity ?? 1);
      const amount = Number((entry as Record<string, unknown>).amount_cents ?? 0);
      if (!id || !label || !Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(amount)) {
        return null;
      }
      return { id, label, quantity, amount_cents: amount };
    })
    .filter((item): item is PricingRequest["lineItems"][number] => item !== null);

  if (lineItems.length === 0) {
    lineItems.push({
      id: "base",
      label: "Base itinerary",
      quantity: 1,
      amount_cents: baseTotalCents,
    });
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  return {
    itineraryId,
    promoCode,
    baseTotalCents,
    currency,
    lineItems,
    requestKey,
  };
}

async function deriveRequestKey(parts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const payload = encoder.encode(parts.join(":"));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `pricing-${hex.slice(0, 32)}`;
}

async function fetchExistingApplication(key: string): Promise<PricingApplicationRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/pricing.applications?select=id,rule_id,promo_code,discount_cents,currency,breakdown,request_key&limit=1&request_key=eq.${encodeURIComponent(key)}`,
    { headers: PRICING_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load pricing application: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as PricingApplicationRow;
}

async function fetchActiveRule(code: string): Promise<PricingRuleRow | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/pricing.rules?select=id,code,kind,value,currency,max_redemptions,per_user_limit,starts_at,ends_at,metadata&limit=1&code=eq.${encodeURIComponent(code)}`,
    { headers: PRICING_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load pricing rule: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  const rule = rows[0] as PricingRuleRow;
  const now = Date.now();
  if (rule.starts_at && new Date(rule.starts_at).getTime() > now) return null;
  if (rule.ends_at && new Date(rule.ends_at).getTime() < now) return null;
  return rule;
}

async function enforceRedemptionLimits(params: { profileId: string; rule: PricingRuleRow }) {
  const { profileId, rule } = params;
  const totalLimit = typeof rule.max_redemptions === "number" ? rule.max_redemptions : null;
  const userLimit = typeof rule.per_user_limit === "number" ? rule.per_user_limit : null;

  if (!totalLimit && !userLimit) return;

  const baseUrl = `${SUPABASE_URL}/rest/v1/pricing.applications?rule_id=eq.${rule.id}`;
  if (totalLimit) {
    const totalCount = await fetchCount(`${baseUrl}`);
    if (totalCount >= totalLimit) {
      const error = new Error("Promo code has reached redemption limit");
      (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
      throw error;
    }
  }
  if (userLimit) {
    const userCount = await fetchCount(`${baseUrl}&profile_id=eq.${profileId}`);
    if (userCount >= userLimit) {
      const error = new Error("Promo code already used by this profile");
      (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
      throw error;
    }
  }
}

async function fetchCount(url: string): Promise<number> {
  const response = await fetch(`${url}&select=id`, {
    headers: {
      ...PRICING_HEADERS,
      Prefer: "count=exact",
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to count records: ${text}`);
  }
  const range = response.headers.get("content-range");
  if (!range) return 0;
  const total = Number(range.split("/")[1] ?? "0");
  return Number.isFinite(total) ? total : 0;
}

function calculateDiscount(params: {
  rule: PricingRuleRow;
  baseTotalCents: number;
  currency: string;
}): { discountCents: number; message?: string } {
  const { rule, baseTotalCents } = params;
  if (rule.kind === "fixed_amount") {
    const valueCents = Math.max(0, Math.round((rule.value ?? 0) * 100));
    return { discountCents: Math.min(baseTotalCents, valueCents) };
  }
  if (rule.kind === "loyalty_multiplier") {
    const bonus = Math.round(baseTotalCents * (rule.value ?? 0) / 100);
    return {
      discountCents: Math.min(baseTotalCents, bonus),
      message: "Applied loyalty multiplier",
    };
  }
  const pct = Math.max(0, rule.value ?? 0);
  const discount = Math.round(baseTotalCents * pct / 100);
  return {
    discountCents: Math.min(baseTotalCents, discount),
  };
}

async function insertApplication(params: {
  profileId: string;
  itineraryId: string;
  ruleId: string;
  promoCode: string;
  baseTotalCents: number;
  discountCents: number;
  currency: string;
  breakdown: Record<string, unknown>;
  requestKey: string;
}): Promise<PricingApplicationRow> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/pricing.applications`, {
    method: "POST",
    headers: APPLICATION_HEADERS,
    body: JSON.stringify({
      profile_id: params.profileId,
      itinerary_id: params.itineraryId,
      rule_id: params.ruleId,
      promo_code: params.promoCode,
      base_total_cents: params.baseTotalCents,
      discount_cents: params.discountCents,
      currency: params.currency,
      breakdown: params.breakdown,
      request_key: params.requestKey,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert pricing application: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Unexpected response inserting pricing application");
  }
  return rows[0] as PricingApplicationRow;
}

function logEvent(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "pricing.apply",
      fn: "pricing-apply",
      ...fields,
    }),
  );
}
