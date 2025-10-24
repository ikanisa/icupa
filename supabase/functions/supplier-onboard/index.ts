// Edge function to expose supplier onboarding queue with structured telemetry.
import queueFixture from "../../../ops/fixtures/supplier_onboarding.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "0") === "1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface SupplierPayload {
  supplier_name: string;
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  region?: string;
  onboarding_stage?: string;
  priority?: number;
  notes?: string;
}

interface SupplierQueueRow extends SupplierPayload {
  id: string;
  status: string;
  assigned_admin: string;
  submitted_at: string;
  updated_at: string;
  last_touch_at: string | null;
  compliance_score: number;
  docs_received: string[];
  hours_open: number;
  hours_since_touch: number;
}

interface StageSummaryRow {
  onboarding_stage: string;
  status: string;
  total: number;
  avg_priority: string;
  median_hours_open: string;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function validatePayload(payload: unknown): SupplierPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const shape = payload as Record<string, unknown>;
  const supplierName = typeof shape.supplier_name === "string" ? shape.supplier_name.trim() : "";
  const contactEmail = typeof shape.contact_email === "string" ? shape.contact_email.trim() : "";
  if (!supplierName || supplierName.length < 2 || supplierName.length > 120) {
    return null;
  }
  if (!contactEmail || !/^[^@]+@[^@]+\.[^@]+$/u.test(contactEmail)) {
    return null;
  }
  const sanitized: SupplierPayload = {
    supplier_name: supplierName,
    contact_email: contactEmail.toLowerCase(),
  };
  if (typeof shape.contact_name === "string") {
    sanitized.contact_name = shape.contact_name.trim();
  }
  if (typeof shape.contact_phone === "string") {
    sanitized.contact_phone = shape.contact_phone.trim();
  }
  if (typeof shape.region === "string") {
    sanitized.region = shape.region.trim();
  }
  if (typeof shape.onboarding_stage === "string") {
    sanitized.onboarding_stage = shape.onboarding_stage.trim();
  }
  if (typeof shape.priority === "number" && Number.isFinite(shape.priority)) {
    sanitized.priority = Math.max(1, Math.min(5, Math.round(shape.priority)));
  }
  if (typeof shape.notes === "string") {
    sanitized.notes = shape.notes.trim();
  }
  return sanitized;
}

async function fetchQueue(): Promise<SupplierQueueRow[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Supabase configuration missing"), {
      code: ERROR_CODES.CONFIGURATION,
    });
  }
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.v_supplier_onboarding_queue?select=*`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to fetch onboarding queue: ${text}`), {
      code: ERROR_CODES.SUPPLIER_TIMEOUT,
    });
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    return [];
  }
  return data as SupplierQueueRow[];
}

async function fetchStageSummary(): Promise<StageSummaryRow[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Supabase configuration missing"), {
      code: ERROR_CODES.CONFIGURATION,
    });
  }
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ops.v_supplier_onboarding_stage_summary?select=*`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to fetch onboarding summary: ${text}`), {
      code: ERROR_CODES.SUPPLIER_TIMEOUT,
    });
  }
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as StageSummaryRow[]) : [];
}

async function createQueueEntry(payload: SupplierPayload, requestId: string) {
  if (USE_FIXTURES) {
    console.info(
      JSON.stringify({
        level: "INFO",
        fn: "supplier-onboard",
        event: "supplier.onboard.fixture",
        requestId,
        payload,
      }),
    );
    return { ok: true, id: `fixture-${crypto.randomUUID()}` };
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Supabase configuration missing"), {
      code: ERROR_CODES.CONFIGURATION,
    });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/ops.supplier_onboarding_queue`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      supplier_name: payload.supplier_name,
      contact_email: payload.contact_email,
      contact_name: payload.contact_name ?? null,
      contact_phone: payload.contact_phone ?? null,
      region: payload.region ?? null,
      onboarding_stage: payload.onboarding_stage ?? "intake",
      priority: payload.priority ?? 3,
      notes: payload.notes ?? null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to insert queue entry: ${text}`), {
      code: ERROR_CODES.SUPPLIER_TIMEOUT,
    });
  }
  const result = (await response.json()) as Array<{ id: string }>;
  return {
    ok: true,
    id: result?.[0]?.id ?? "",
  };
}

Deno.serve(
  withObs(async (req) => {
    const requestId = getRequestId(req) ?? crypto.randomUUID();
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      return healthResponse("supplier-onboard");
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const payload = validatePayload(body);
      if (!payload) {
        return json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }
      const result = await createQueueEntry(payload, requestId);
      return json({ ok: true, id: result.id, request_id: requestId }, { status: 201 });
    }

    if (req.method !== "GET") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const includeSummary = url.searchParams.get("summary") === "1";

    if (USE_FIXTURES) {
      const data = queueFixture as SupplierQueueRow[];
      const summary = includeSummary
        ? [
            {
              onboarding_stage: "intake",
              status: "pending",
              total: 1,
              avg_priority: "3.00",
              median_hours_open: "40.0",
            },
            {
              onboarding_stage: "kyc-review",
              status: "in_progress",
              total: 1,
              avg_priority: "2.00",
              median_hours_open: "72.0",
            },
          ]
        : [];

      console.log(
        JSON.stringify({
          level: "AUDIT",
          fn: "supplier-onboard",
          event: "supplier.onboard.read",
          requestId,
          source: "fixtures",
          records: data.length,
          includeSummary,
        }),
      );

      return json({ ok: true, data, summary, request_id: requestId });
    }

    const [data, summary] = await Promise.all([
      fetchQueue(),
      includeSummary ? fetchStageSummary() : Promise.resolve([] as StageSummaryRow[]),
    ]);

    console.log(
      JSON.stringify({
        level: "AUDIT",
        fn: "supplier-onboard",
        event: "supplier.onboard.read",
        requestId,
        source: "view",
        records: data.length,
        includeSummary,
      }),
    );

    return json({ ok: true, data, summary, request_id: requestId });
  }, { fn: "supplier-onboard", defaultErrorCode: ERROR_CODES.UNKNOWN }),
);
