import { ERROR_CODES } from "../_obs/constants.ts";
import { healthResponse, withObs } from "../_obs/withObs.ts";
import { B2BAuthError, requireB2BKey } from "../b2b-auth/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "b2b-lead-intent requires SUPABASE_URL and SUPABASE_SERVICE_ROLE for persistence.",
  );
}

interface LeadPayload {
  company_name: string;
  contact_name?: string;
  email: string;
  phone?: string;
  notes?: string;
  party_size?: number;
  start_date?: string;
  end_date?: string;
  destinations?: string[];
  budget_min_cents?: number;
  budget_max_cents?: number;
}

class IdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT" as const;
}

interface IntentRecord {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  party_size: number | null;
  start_date: string | null;
  end_date: string | null;
  destinations: string[];
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  idempotency_key: string;
}

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("b2b-lead-intent");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  const idempotencyKey = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return jsonResponse({ ok: false, error: "missing_idempotency_key" }, 400);
  }

  let payload: LeadPayload;
  try {
    payload = await req.json() as LeadPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    return jsonResponse({ ok: false, error: "invalid_payload", details: validationErrors }, 400);
  }

  let principal;
  try {
    principal = await requireB2BKey(req, { scopes: ["leads.write"] });
  } catch (error) {
    if (error instanceof B2BAuthError) {
      return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
    }
    throw error;
  }

  let intent = await findIntentByIdempotency({ idempotencyKey, apiKeyId: principal.id });
  let reused = false;

  if (!intent) {
    try {
      intent = await insertIntent({
        api_key_id: principal.id,
        idempotency_key: idempotencyKey,
        payload,
      });
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        intent = await findIntentByIdempotency({ idempotencyKey, apiKeyId: principal.id });
        if (intent) {
          reused = true;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  } else {
    reused = true;
  }

  if (!intent) {
    throw new Error("Intent record missing after idempotency handling");
  }

  return jsonResponse({
    ok: true,
    idempotency_reused: reused,
    intent,
  }, reused ? 200 : 201);
}, { fn: "b2b-lead-intent", defaultErrorCode: ERROR_CODES.AUTH_REQUIRED });

Deno.serve(handler);

export { handler };

function validatePayload(payload: LeadPayload): string[] {
  const errors: string[] = [];
  if (!payload || typeof payload.company_name !== "string" || payload.company_name.trim().length === 0) {
    errors.push("company_name is required");
  }
  if (!payload || typeof payload.email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    errors.push("email must be valid");
  }
  if (payload.party_size !== undefined && (!Number.isInteger(payload.party_size) || payload.party_size <= 0)) {
    errors.push("party_size must be a positive integer");
  }
  if (payload.start_date && !isValidDate(payload.start_date)) {
    errors.push("start_date must be YYYY-MM-DD");
  }
  if (payload.end_date && !isValidDate(payload.end_date)) {
    errors.push("end_date must be YYYY-MM-DD");
  }
  if (payload.destinations !== undefined) {
    if (!Array.isArray(payload.destinations)) {
      errors.push("destinations must be an array of strings");
    } else if (payload.destinations.some((value) => typeof value !== "string" || value.trim().length === 0)) {
      errors.push("destinations entries must be non-empty strings");
    }
  }
  if (payload.budget_min_cents !== undefined && (!Number.isFinite(payload.budget_min_cents) || payload.budget_min_cents < 0)) {
    errors.push("budget_min_cents must be a positive number");
  }
  if (payload.budget_max_cents !== undefined && (!Number.isFinite(payload.budget_max_cents) || payload.budget_max_cents < 0)) {
    errors.push("budget_max_cents must be a positive number");
  }
  if (
    payload.budget_min_cents !== undefined &&
    payload.budget_max_cents !== undefined &&
    payload.budget_min_cents > payload.budget_max_cents
  ) {
    errors.push("budget_min_cents cannot exceed budget_max_cents");
  }
  return errors;
}

async function findIntentByIdempotency(input: {
  idempotencyKey: string;
  apiKeyId: string;
}): Promise<IntentRecord | null> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/intents`);
  url.searchParams.set("select", "id,company_name,contact_name,email,phone,party_size,start_date,end_date,destinations,notes,status,created_at,updated_at,idempotency_key");
  url.searchParams.set("idempotency_key", `eq.${input.idempotencyKey}`);
  url.searchParams.set("api_key_id", `eq.${input.apiKeyId}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Accept-Profile": "travel",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load intent: ${response.status}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload) && payload.length > 0) {
    return serializeIntent(payload[0]);
  }
  return null;
}

async function insertIntent(input: {
  api_key_id: string;
  idempotency_key: string;
  payload: LeadPayload;
}): Promise<IntentRecord> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/intents`);
  url.searchParams.set("select", "id,company_name,contact_name,email,phone,party_size,start_date,end_date,destinations,notes,status,created_at,updated_at,idempotency_key");

  const body = {
    api_key_id: input.api_key_id,
    company_name: input.payload.company_name,
    contact_name: input.payload.contact_name ?? null,
    email: input.payload.email,
    phone: input.payload.phone ?? null,
    notes: input.payload.notes ?? null,
    party_size: input.payload.party_size ?? null,
    start_date: input.payload.start_date ?? null,
    end_date: input.payload.end_date ?? null,
    destinations: cleanDestinations(input.payload.destinations),
    budget_min_cents: input.payload.budget_min_cents ?? null,
    budget_max_cents: input.payload.budget_max_cents ?? null,
    idempotency_key: input.idempotency_key,
    raw_payload: input.payload,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Accept-Profile": "travel",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 409) {
      throw new IdempotencyConflictError(`Idempotency conflict for key ${input.idempotency_key}`);
    }
    throw new Error(`Failed to insert intent: ${response.status} ${text}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload) && payload.length > 0) {
    return serializeIntent(payload[0]);
  }
  throw new Error("Unexpected insert response");
}

function isValidDate(value: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function cleanDestinations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function serializeIntent(record: Record<string, unknown>): IntentRecord {
  const id = typeof record.id === "string" ? record.id : String(record.id ?? "");
  if (!id) {
    throw new Error("Intent record missing id");
  }

  return {
    id,
    company_name: typeof record.company_name === "string"
      ? record.company_name
      : String(record.company_name ?? ""),
    contact_name: typeof record.contact_name === "string" ? record.contact_name : null,
    email: typeof record.email === "string" ? record.email : String(record.email ?? ""),
    phone: typeof record.phone === "string" ? record.phone : null,
    party_size: typeof record.party_size === "number"
      ? record.party_size
      : record.party_size === null
      ? null
      : Number.isFinite(Number(record.party_size))
      ? Number(record.party_size)
      : null,
    start_date: typeof record.start_date === "string" ? record.start_date : null,
    end_date: typeof record.end_date === "string" ? record.end_date : null,
    destinations: cleanDestinations(record.destinations),
    notes: typeof record.notes === "string" ? record.notes : null,
    status: typeof record.status === "string" ? record.status : "new",
    created_at: typeof record.created_at === "string"
      ? record.created_at
      : new Date().toISOString(),
    updated_at: typeof record.updated_at === "string"
      ? record.updated_at
      : new Date().toISOString(),
    idempotency_key: typeof record.idempotency_key === "string"
      ? record.idempotency_key
      : String(record.idempotency_key ?? ""),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
